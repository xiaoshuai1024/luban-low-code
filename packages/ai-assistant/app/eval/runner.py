"""eval/runner.py — 设计稿转页面评测运行器（plan P2-T5）。

对样本集逐个跑 design workflow，聚合指标（合法率/还原度/物料正确性）。
真实 VLM 调用（需 key），默认不在 CI 跑（-m eval 触发）。

用法：
  uv run python -m app.eval.runner                 # 跑全部样本
  uv run python -m app.eval.runner --manifest X    # 指定 manifest
  uv run python -m app.eval.runner --json          # 输出 JSON
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from app.agent.design_graph import DesignRunner
from app.agent.design_nodes import DesignDeps, DesignState
from app.api.ai_deps import get_agent_deps
from app.core.config import get_settings
from app.eval.dataset import EvalSample, load_dataset
from app.eval.metrics import EvalSummary, SampleMetrics, aggregate, evaluate_sample
from app.llm.multimodal import vision_model_info
from app.storage.minio import ImageStore

logger = logging.getLogger(__name__)


async def run_sample(
    sample: EvalSample,
    runner: DesignRunner,
    registry_obj: object,
) -> SampleMetrics:
    """跑单个样本 → SampleMetrics。"""
    from app.schemas.validators import MaterialRegistry

    registry = registry_obj if isinstance(registry_obj, MaterialRegistry) else MaterialRegistry()
    image_bytes = sample.load_image()
    vinfo = vision_model_info(get_settings())
    state = DesignState(
        job_id=f"eval-{sample.id}",
        user_id="eval",
        image_key=f"eval/{sample.id}.png",
        image_bytes=image_bytes,
        image_mime="image/png",
        user_prompt=sample.expected_layout or sample.name,
        model_provider=vinfo.provider,
        model_name=vinfo.model,
    )
    state.add_progress("uploaded", key=state.image_key)
    try:
        state = await runner.run(state)
    except Exception as e:
        logger.error("样本 %s 运行失败: %s", sample.id, e)
    metrics = evaluate_sample(state.generated_schema, sample.expected_materials, registry)
    metrics.sample_id = sample.id
    return metrics


async def run_eval(manifest_path: str | None = None) -> EvalSummary:
    """跑整个样本集 → EvalSummary。"""
    settings = get_settings()
    dataset = load_dataset(manifest_path)
    if len(dataset) == 0:
        logger.warning("样本集为空，跳过（放入样本到 eval/samples/ 后重跑）")
        return aggregate([])

    deps = get_agent_deps(settings)
    image_store = ImageStore(settings)
    design_deps = DesignDeps(
        provider=deps.provider, image_store=image_store, registry=deps.registry
    )
    runner = DesignRunner(design_deps)

    per_sample = []
    for sample in dataset:
        logger.info("评测样本 %s: %s", sample.id, sample.name)
        m = await run_sample(sample, runner, deps.registry)
        per_sample.append(m)
    return aggregate(per_sample)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="设计稿转页面评测")
    parser.add_argument("--manifest", default=None, help="样本集 manifest 路径")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    args = parser.parse_args()

    summary = asyncio.run(run_eval(args.manifest))
    if args.json:
        print(json.dumps(summary.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(f"样本数: {summary.total}")
        print(f"合法率: {summary.validity_rate:.2%}")
        print(f"还原度(recall): {summary.recall_mean:.2%}")
        print(f"物料正确性(precision): {summary.precision_mean:.2%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

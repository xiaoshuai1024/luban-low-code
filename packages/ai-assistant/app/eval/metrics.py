"""eval/metrics.py — 设计稿转页面评测指标（plan P2-T5）。

三个核心指标：
  1. 合法率（validity）：生成 schema 是否通过校验闸（Pydantic + 物料 + props）。
  2. 还原度（recall）：期望物料在生成 schema 中的命中率（expected_materials ∩ generated / expected）。
  3. 物料正确性（precision）：生成物料中属于期望物料的占比（generated ∩ expected / generated）。

诚实声明（plan §3）：P2 eval 只评「结构与组件识别」，不评像素级样式还原（延后）。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.page_schema import NodeSchema, PageSchema
from app.schemas.validators import MaterialRegistry, validate_page_schema


@dataclass
class SampleMetrics:
    """单个样本的评测结果。"""

    sample_id: str
    validity: bool  # 是否通过校验闸
    recall: float  # 还原度（期望物料命中率）[0,1]
    precision: float  # 物料正确性 [0,1]
    missing_expected: list[str]  # 期望但未生成的物料
    unexpected_generated: list[str]  # 生成但非期望的物料
    error: str | None = None


def _collect_materials(node: NodeSchema, out: set[str]) -> None:
    out.add(node.type)
    for c in node.children or []:
        _collect_materials(c, out)


def evaluate_sample(
    generated: PageSchema | None,
    expected_materials: list[str],
    registry: MaterialRegistry,
) -> SampleMetrics:
    """评测单样本。"""
    sample_id = "eval"  # runner 注入真实 id
    if generated is None:
        return SampleMetrics(
            sample_id=sample_id,
            validity=False,
            recall=0.0,
            precision=0.0,
            missing_expected=list(expected_materials),
            unexpected_generated=[],
            error="无生成产物",
        )

    # 1. 合法率
    try:
        validate_page_schema(generated, registry)
        validity = True
    except Exception as e:
        return SampleMetrics(
            sample_id=sample_id,
            validity=False,
            recall=0.0,
            precision=0.0,
            missing_expected=list(expected_materials),
            unexpected_generated=[],
            error=str(e),
        )

    # 2/3. 物料命中
    gen_materials: set[str] = set()
    _collect_materials(generated.root, gen_materials)
    expected_set = set(expected_materials)
    hit = gen_materials & expected_set
    missing = expected_set - gen_materials
    unexpected = gen_materials - expected_set - {"LubanPage", "LubanContainer"}  # 容器类不算误判

    recall = len(hit) / len(expected_set) if expected_set else 1.0
    precision = len(hit) / len(gen_materials) if gen_materials else 0.0

    return SampleMetrics(
        sample_id=sample_id,
        validity=validity,
        recall=recall,
        precision=precision,
        missing_expected=sorted(missing),
        unexpected_generated=sorted(unexpected),
    )


@dataclass
class EvalSummary:
    """样本集聚合指标。"""

    total: int
    validity_rate: float  # 合法率均值
    recall_mean: float  # 还原度均值
    precision_mean: float  # 物料正确性均值
    per_sample: list[SampleMetrics]

    def to_dict(self) -> dict[str, object]:
        return {
            "total": self.total,
            "validity_rate": round(self.validity_rate, 4),
            "recall_mean": round(self.recall_mean, 4),
            "precision_mean": round(self.precision_mean, 4),
            "per_sample": [
                {
                    "sample_id": m.sample_id,
                    "validity": m.validity,
                    "recall": round(m.recall, 4),
                    "precision": round(m.precision, 4),
                    "missing_expected": m.missing_expected,
                    "unexpected_generated": m.unexpected_generated,
                    "error": m.error,
                }
                for m in self.per_sample
            ],
        }


def aggregate(per_sample: list[SampleMetrics]) -> EvalSummary:
    """聚合样本集指标。"""
    n = len(per_sample)
    if n == 0:
        return EvalSummary(
            total=0, validity_rate=0.0, recall_mean=0.0, precision_mean=0.0, per_sample=[]
        )
    validity_rate = sum(1 for m in per_sample if m.validity) / n
    recall_mean = sum(m.recall for m in per_sample) / n
    precision_mean = sum(m.precision for m in per_sample) / n
    return EvalSummary(
        total=n,
        validity_rate=validity_rate,
        recall_mean=recall_mean,
        precision_mean=precision_mean,
        per_sample=per_sample,
    )


__all__ = ["EvalSummary", "SampleMetrics", "aggregate", "evaluate_sample"]

"""P2-T5 eval 评测单测（plan P2）。

覆盖：load_dataset（空/有 manifest）、evaluate_sample（合法率/还原度/精确）、aggregate 聚合。
"""

from __future__ import annotations

import json
from pathlib import Path

from app.eval.dataset import EvalDataset, load_dataset
from app.eval.metrics import EvalSummary, aggregate, evaluate_sample
from app.schemas.page_schema import NodeSchema, PageSchema
from app.schemas.validators import MaterialRegistry


def _registry() -> MaterialRegistry:
    return MaterialRegistry(materials={"LubanPage": {}, "LubanTable": {}, "LubanMenu": {}})


def test_load_dataset_empty_when_no_manifest(tmp_path: Path) -> None:
    ds = load_dataset(tmp_path / "nonexistent.json")
    assert isinstance(ds, EvalDataset)
    assert len(ds) == 0


def test_load_dataset_from_manifest(tmp_path: Path) -> None:
    manifest = {
        "samples": [
            {
                "id": "s1",
                "name": "用户列表",
                "image_path": "u.png",
                "expected_materials": ["LubanTable", "LubanMenu"],
                "expected_layout": "顶部导航+表格",
                "difficulty": "easy",
            }
        ]
    }
    p = tmp_path / "manifest.json"
    p.write_text(json.dumps(manifest), encoding="utf-8")
    ds = load_dataset(p)
    assert len(ds) == 1
    s = ds.samples[0]
    assert s.id == "s1"
    assert s.expected_materials == ["LubanTable", "LubanMenu"]


def test_evaluate_sample_valid_full_recall() -> None:
    gen = PageSchema(
        root=NodeSchema(
            id="root",
            type="LubanPage",
            children=[
                NodeSchema(id="m", type="LubanMenu"),
                NodeSchema(id="t", type="LubanTable"),
            ],
        )
    )
    m = evaluate_sample(gen, ["LubanTable", "LubanMenu"], _registry())
    assert m.validity is True
    assert m.recall == 1.0


def test_evaluate_sample_partial_recall() -> None:
    gen = PageSchema(
        root=NodeSchema(
            id="root", type="LubanPage", children=[NodeSchema(id="t", type="LubanTable")]
        )
    )
    m = evaluate_sample(gen, ["LubanTable", "LubanMenu"], _registry())
    assert m.recall == 0.5
    assert "LubanMenu" in m.missing_expected


def test_evaluate_sample_invalid_schema() -> None:
    # 缺 id 的根节点会被 _ensure_ids 补齐，不直接失败；用循环引用构造失败
    root = NodeSchema(id="root", type="LubanPage", children=[])
    cyc = NodeSchema(id="c", type="LubanTable")
    root.children = [cyc]
    cyc.children = [root]  # 循环引用 → 校验闸抛错
    gen = PageSchema(root=root)
    m = evaluate_sample(gen, ["LubanTable"], _registry())
    assert m.validity is False
    assert m.error is not None


def test_evaluate_sample_none_generated() -> None:
    m = evaluate_sample(None, ["LubanTable"], _registry())
    assert m.validity is False
    assert m.recall == 0.0


def test_aggregate_summary() -> None:
    from app.eval.metrics import SampleMetrics

    samples = [
        SampleMetrics(
            sample_id="a",
            validity=True,
            recall=1.0,
            precision=1.0,
            missing_expected=[],
            unexpected_generated=[],
        ),
        SampleMetrics(
            sample_id="b",
            validity=False,
            recall=0.5,
            precision=0.5,
            missing_expected=["x"],
            unexpected_generated=[],
        ),
    ]
    summary = aggregate(samples)
    assert summary.total == 2
    assert summary.validity_rate == 0.5
    assert summary.recall_mean == 0.75


def test_aggregate_empty() -> None:
    summary = aggregate([])
    assert summary.total == 0


def test_summary_to_dict_serializable() -> None:
    summary = EvalSummary(
        total=1, validity_rate=1.0, recall_mean=1.0, precision_mean=1.0, per_sample=[]
    )
    d = summary.to_dict()
    assert d["total"] == 1
    json.dumps(d)  # 可序列化

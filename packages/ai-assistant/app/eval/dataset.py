"""eval/dataset.py — 设计稿转页面评测样本集（plan P2-T5）。

样本集结构：每个样本含
  - 设计稿图片（路径/字节）
  - 期望 PageSchema（ground truth，至少含期望的物料类型集合）
  - 元信息（标签/难度）

样本集入库后供 runner 重跑评测。P2 初版：从本地目录加载（eval/samples/），
后续可接 Langfuse dataset 回归。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class EvalSample:
    """单个评测样本。"""

    id: str
    name: str
    image_path: str
    expected_materials: list[str] = field(default_factory=list)  # 期望出现的物料类型
    expected_layout: str | None = None  # 期望布局描述（语义对比用）
    tags: list[str] = field(default_factory=list)
    difficulty: str = "easy"  # easy | medium | hard

    def load_image(self, base_dir: Path | None = None) -> bytes:
        root = base_dir or Path(__file__).resolve().parent / "samples"
        p = root / self.image_path
        return p.read_bytes()


@dataclass
class EvalDataset:
    """样本集。"""

    samples: list[EvalSample] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.samples)

    def __iter__(self):  # type: ignore[no-untyped-def]
        return iter(self.samples)


def load_dataset(manifest_path: Path | str | None = None) -> EvalDataset:
    """从 manifest JSON 加载样本集。

    manifest 格式：
      { "samples": [
          {"id": "s1", "name": "用户列表页", "image_path": "user-list.png",
           "expected_materials": ["LubanTable","LubanMenu"], "expected_layout": "顶部导航+主体表格",
           "tags": ["data"], "difficulty": "easy"}
        ]
      }
    缺省路径：eval/samples/manifest.json。
    """
    if manifest_path is None:
        manifest_path = Path(__file__).resolve().parent / "samples" / "manifest.json"
    p = Path(manifest_path)
    if not p.exists():
        # 无样本集 → 空数据集（runner 跳过，不报错）
        return EvalDataset()
    raw = json.loads(p.read_text(encoding="utf-8"))
    samples = [
        EvalSample(
            id=s["id"],
            name=s["name"],
            image_path=s["image_path"],
            expected_materials=s.get("expected_materials", []),
            expected_layout=s.get("expected_layout"),
            tags=s.get("tags", []),
            difficulty=s.get("difficulty", "easy"),
        )
        for s in raw.get("samples", [])
    ]
    return EvalDataset(samples=samples)


__all__ = ["EvalDataset", "EvalSample", "load_dataset"]

# 布局组件

布局组件用于组织页面结构和排列子组件。

## Container

通用容器组件，限定最大宽度并提供内边距。

```json
{
  "type": "LubanContainer",
  "props": {
    "maxWidth": "lg",
    "padded": true
  }
}
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| maxWidth | `sm \| md \| lg \| full` | `lg` | 最大宽度 |
| padded | boolean | true | 是否有内边距 |

## Row

Flex 行容器，按方向排列子节点。

```json
{
  "type": "LubanRow",
  "props": {
    "direction": "row",
    "align": "center",
    "justify": "between",
    "wrap": true
  }
}
```

## Col

Flex 列容器，作为 Row 子项使用。

```json
{
  "type": "LubanCol",
  "props": {
    "span": 6
  }
}
```

## SidePanel

侧滑面板，从右侧/左侧/上/下四个方向滑出。

```json
{
  "type": "LubanSidePanel",
  "props": {
    "size": "medium",
    "title": "面板标题"
  }
}
```

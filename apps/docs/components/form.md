# 表单组件

表单组件用于数据采集和用户输入。

## Input

通用输入框，支持文本、密码、数字等类型。

```json
{
  "type": "LubanInput",
  "props": {
    "placeholder": "请输入",
    "type": "text",
    "disabled": false
  }
}
```

## Select

下拉选择框。

```json
{
  "type": "LubanSelect",
  "props": {
    "placeholder": "请选择",
    "options": [
      { "label": "选项A", "value": "a" },
      { "label": "选项B", "value": "b" }
    ]
  }
}
```

## TextArea

多行文本输入。

```json
{
  "type": "LubanTextArea",
  "props": {
    "placeholder": "请输入内容",
    "rows": 4
  }
}
```

## Checkbox / Switch / RadioGroup

```json
{ "type": "LubanCheckbox", "props": { "label": "同意条款" } }
{ "type": "LubanSwitch", "props": { "label": "启用" } }
{ "type": "LubanRadioGroup", "props": { "options": [{"label":"A","value":"a"}] } }
```

## Form

表单容器，绑定字段到 formState，支持提交事件。

```json
{
  "type": "LubanForm",
  "props": {
    "submitConfig": {
      "formId": "uuid",
      "mode": "toast",
      "toastMessage": "提交成功"
    }
  },
  "children": [
    { "type": "LubanInput", "props": { "name": "phone" } }
  ]
}
```

提交模式：`toast`（提示）/ `popup`（弹窗）/ `redirect`（跳转）。

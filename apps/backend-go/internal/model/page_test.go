package model

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestPage_SchemaNotBase64 是 Bug 1 的 reproduction 测试。
//
// 背景：Schema 字段曾经声明为 []byte，encoding/json 会把 []byte 编码为
// base64 字符串，破坏 BFF/website 对 schema 的嵌套对象解析（Java 端 JsonNode
// 是嵌套对象）。改为 json.RawMessage 后，schema 应原样作为嵌套 JSON 对象输出。
//
// 失败即代表 Bug 1 回归。
func TestPage_SchemaNotBase64(t *testing.T) {
	page := Page{
		ID:     "p-1",
		SiteID: "s-1",
		Name:   "home",
		Path:   "/",
		Status: "draft",
		Schema: json.RawMessage(`{"root":{"id":"root","type":"Page"}}`),
	}

	out, err := json.Marshal(page)
	if err != nil {
		t.Fatalf("json.Marshal page: %v", err)
	}
	s := string(out)

	// 1) schema 必须以嵌套对象形式出现：值起始为 {"root"
	wantFrag := `"schema":{"root":`
	if !strings.Contains(s, wantFrag) {
		t.Fatalf("schema should be a nested JSON object containing %q, got: %s", wantFrag, s)
	}

	// 2) schema 不能是 base64 字符串：值不能以 " 跟随一串 base64 字符开头。
	//    base64 输出形如 "schema":"eyA...，这里断言不存在 "schema":"ey 这种前缀
	//    （"ey" 是 {" 的 base64 起始，是 []byte 编码时的典型特征）。
	//    注意：合法的嵌套对象 JSON 字符串值也可能以 "ey" 开头，但此处 schema 是
	//    固定输入 {"root":...}，base64 编码后必然以 "eyA= 或 "eyJ 开头。
	badBase64Frag := `"schema":"ey`
	if strings.Contains(s, badBase64Frag) {
		t.Fatalf("schema was base64-encoded ([]byte regression), got: %s", s)
	}

	// 3) 二次校验：把外层 JSON 解出来，schema 字段应是 object（map），不是 string。
	var generic map[string]json.RawMessage
	if err := json.Unmarshal(out, &generic); err != nil {
		t.Fatalf("unmarshal to map[string]json.RawMessage: %v", err)
	}
	schemaRaw, ok := generic["schema"]
	if !ok {
		t.Fatalf("missing schema key in output: %s", s)
	}
	trimmed := strings.TrimSpace(string(schemaRaw))
	if len(trimmed) == 0 || trimmed[0] != '{' {
		t.Fatalf("schema should decode to a JSON object (start with '{'), got: %s", trimmed)
	}
}

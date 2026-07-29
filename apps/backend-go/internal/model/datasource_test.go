package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDatasource_ConfigNotBase64Encoded guards the same regression as
// TestPage_SchemaNotBase64Encoded: a json.RawMessage Config must marshal as a
// nested JSON object, not a base64-encoded string. This keeps the BFF/engine
// datasource contract intact across the wire.
func TestDatasource_ConfigNotBase64Encoded(t *testing.T) {
	ds := Datasource{
		ID:     "ds-1",
		SiteID: "s-1",
		Name:   "users",
		Type:   "api",
		Config: json.RawMessage(`{"url":"https://example.com","headers":{"X-A":"1"}}`),
	}

	out, err := json.Marshal(ds)
	require.NoError(t, err)

	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(out, &raw))

	var cfg map[string]interface{}
	require.NoError(t, json.Unmarshal(raw["config"], &cfg))
	assert.Equal(t, "https://example.com", cfg["url"])

	headers, ok := cfg["headers"].(map[string]interface{})
	require.True(t, ok, "headers must be a nested object, not a string")
	assert.Equal(t, "1", headers["X-A"])

	// Sanity: the whole object round-trips back into a Datasource with the same Config bytes.
	var round Datasource
	require.NoError(t, json.Unmarshal(out, &round))
	assert.JSONEq(t, string(ds.Config), string(round.Config))
}

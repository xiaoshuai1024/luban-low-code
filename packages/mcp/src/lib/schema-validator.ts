/**
 * Schema Validator for Luban low-code page schemas.
 *
 * Validates a complete PageSchema JSON against structural rules:
 *  - Root node type must be "LubanContainer"
 *  - All NodeSchema nodes must have non-empty `id` and `type`
 *  - Container nodes (with children) must not have `textContent`
 *  - Leaf nodes (without children) may have `props`
 *  - `children` must be an array when present
 */

export interface ValidationError {
  /** JSON path to the invalid node, e.g. "$.nodes[0]" or "$.nodes[0].children[1]" */
  path: string;
  /** Human-readable description of the violation */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Recursively validate a single NodeSchema against structural rules.
 *
 * @param node      The node to validate (raw object, may contain extra keys)
 * @param path      Current JSON path for error reporting
 * @param errors    Accumulator array for validation errors
 */
function validateNode(
  node: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): void {
  // --- Rule (b): id must be a non-empty string ---
  if (typeof node.id !== 'string' || node.id.trim() === '') {
    errors.push({
      path,
      message: `节点缺少非空 id（当前值: ${JSON.stringify(node.id)}）`,
    });
  }

  // --- Rule (c): type must be a non-empty string ---
  if (typeof node.type !== 'string' || node.type.trim() === '') {
    errors.push({
      path,
      message: `节点缺少非空 type（当前值: ${JSON.stringify(node.type)}）`,
    });
  }

  const hasChildren = Array.isArray(node.children);
  const hasTextContent = node.textContent !== undefined;

  // --- Rule (d): children must be an array (when present) ---
  if (node.children !== undefined && !hasChildren) {
    errors.push({
      path,
      message: `children 必须是数组，当前为 ${typeof node.children}`,
    });
  }

  // --- Rule (e): container nodes (with children) must not have textContent ---
  if (hasChildren && hasTextContent) {
    errors.push({
      path,
      message:
        `容器节点（含有 children）不应包含 textContent（值: ${JSON.stringify(node.textContent)}）`,
    });
  }

  // --- Recursively validate children ---
  if (hasChildren) {
    const children = node.children as unknown[];
    children.forEach((child, index) => {
      if (child !== null && typeof child === 'object') {
        validateNode(
          child as Record<string, unknown>,
          `${path}.children[${index}]`,
          errors,
        );
      } else {
        errors.push({
          path: `${path}.children[${index}]`,
          message: `子节点必须是对象，当前为 ${typeof child}`,
        });
      }
    });
  }

  // Note on rule (f): leaf nodes (no children) may have props — this is allowed,
  // not an error, so no violation is raised.
}

/**
 * Validate a complete page schema against Luban structural rules.
 *
 * @param schema  The raw page schema JSON object (expected to conform to PageSchema shape)
 * @returns       ValidationResult with `valid` flag and array of errors
 */
export function validatePageSchema(schema: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (schema === null || typeof schema !== 'object') {
    errors.push({
      path: '$',
      message: 'PageSchema 必须是 JSON 对象',
    });
    return { valid: false, errors };
  }

  const root = schema as Record<string, unknown>;

  // --- Ensure the page has a `nodes` array ---
  if (!Array.isArray(root.nodes)) {
    errors.push({
      path: '$.nodes',
      message: 'PageSchema 缺少 nodes 数组',
    });
    // If there's no nodes array, we cannot validate further
    return { valid: false, errors };
  }

  if (root.nodes.length === 0) {
    errors.push({
      path: '$.nodes',
      message: 'PageSchema.nodes 不能为空',
    });
    return { valid: false, errors };
  }

  // --- Validate each root-level node ---
  root.nodes.forEach((node, index) => {
    if (node !== null && typeof node === 'object') {
      const nodeObj = node as Record<string, unknown>;
      const nodePath = `$.nodes[${index}]`;

      // --- Rule (a): root node type must be "LubanContainer" ---
      if (nodeObj.type !== 'LubanContainer') {
        errors.push({
          path: nodePath,
          message: `根节点 type 必须是 "LubanContainer"，当前为 ${JSON.stringify(nodeObj.type)}`,
        });
      }

      validateNode(nodeObj, nodePath, errors);
    } else {
      errors.push({
        path: `$.nodes[${index}]`,
        message: `根节点必须是对象，当前为 ${typeof node}`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

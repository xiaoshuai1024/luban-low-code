/**
 * Validation rules for form fields. All fields are optional; each rule type has its own message.
 * Designer can configure these in node.props.rules (JSON-serializable).
 */
export interface ValidationRule {
  /** Required field */
  required?: boolean;
  /** Built-in type: email, tel, url, number (for string inputs) */
  type?: 'email' | 'tel' | 'url' | 'number';
  /** Min string length */
  minLength?: number;
  /** Max string length */
  maxLength?: number;
  /** Min number value */
  min?: number;
  /** Max number value */
  max?: number;
  /** Regex pattern (string source, e.g. "^[a-z]+$") */
  pattern?: string;
  /** Error message for this rule when it fails */
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[\d\s\-+()]+$/;
const URL_RE = /^https?:\/\/.+/;

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

/** For checkbox/switch: required means value must be true */
function isRequiredButUnchecked(rule: ValidationRule, value: unknown): boolean {
  return !!(rule.required && typeof value === 'boolean' && !value);
}

/**
 * Run validation rules against a value. Returns the first error message or null if valid.
 */
export function validate(value: unknown, rules: ValidationRule[] | undefined): string | null {
  if (!rules?.length) return null;

  const str = value != null ? String(value).trim() : '';
  const num = typeof value === 'number' ? value : Number(value);

  for (const rule of rules) {
    // required (string/number/null/undefined)
    if (rule.required && isEmpty(value)) {
      return rule.message ?? '必填';
    }
    // required for checkbox/switch: must be checked
    if (isRequiredButUnchecked(rule, value)) {
      return rule.message ?? '必填';
    }
    // if empty and not required, skip other rules (optional field)
    if (isEmpty(value) && !rule.required) continue;

    // type
    if (rule.type) {
      if (rule.type === 'email' && !EMAIL_RE.test(str)) {
        return rule.message ?? '请输入有效的邮箱地址';
      }
      if (rule.type === 'tel' && !TEL_RE.test(str)) {
        return rule.message ?? '请输入有效的电话号码';
      }
      if (rule.type === 'url' && !URL_RE.test(str)) {
        return rule.message ?? '请输入有效的 URL';
      }
      if (rule.type === 'number' && str !== '' && Number.isNaN(num)) {
        return rule.message ?? '请输入有效数字';
      }
    }

    // minLength / maxLength (string)
    if (rule.minLength != null && str.length < rule.minLength) {
      return rule.message ?? `至少 ${rule.minLength} 个字符`;
    }
    if (rule.maxLength != null && str.length > rule.maxLength) {
      return rule.message ?? `最多 ${rule.maxLength} 个字符`;
    }

    // min / max (number)
    if (rule.min != null && typeof value === 'number' && value < rule.min) {
      return rule.message ?? `不能小于 ${rule.min}`;
    }
    if (rule.max != null && typeof value === 'number' && value > rule.max) {
      return rule.message ?? `不能大于 ${rule.max}`;
    }
    if (rule.min != null && (typeof value === 'string' || typeof value === 'number')) {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(n) && n < rule.min!) {
        return rule.message ?? `不能小于 ${rule.min}`;
      }
    }
    if (rule.max != null && (typeof value === 'string' || typeof value === 'number')) {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(n) && n > rule.max!) {
        return rule.message ?? `不能大于 ${rule.max}`;
      }
    }

    // pattern
    if (rule.pattern) {
      try {
        const re = new RegExp(rule.pattern);
        if (!re.test(str)) {
          return rule.message ?? '格式不正确';
        }
      } catch {
        // invalid regex, skip
      }
    }
  }

  return null;
}

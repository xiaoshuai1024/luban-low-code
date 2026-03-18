/**
 * Component types that accept child nodes (drop zones in designer).
 */
export const CONTAINER_TYPES = new Set<string>([
  'LubanContainer',
  'LubanRow',
  'LubanCol',
  'LubanForm',
]);

export function isContainerType(type: string): boolean {
  return CONTAINER_TYPES.has(type);
}

/**
 * Whether a child type can be dropped into a container type.
 * If acceptTypes is not defined for the container, any registered type is allowed.
 */
export function canAcceptChild(
  containerType: string,
  childType: string,
  getAcceptTypes: (type: string) => string[] | undefined
): boolean {
  if (!CONTAINER_TYPES.has(containerType)) return false;
  const accept = getAcceptTypes(containerType);
  if (accept == null || accept.length === 0) return true;
  return accept.includes(childType);
}

export const getDesignerRoot = () => cy.get('[data-cy="designer-root"]');
export const getDesignerPalette = () => cy.get('[data-cy="designer-palette"]');
export const getDesignerDropZone = () =>
  cy.get('[data-cy="designer-drop-zone"]');
export const getPaletteGroups = () =>
  cy.get('[data-cy^="designer-palette-group-"]');

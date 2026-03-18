import {
  getDesignerRoot,
  getDesignerPalette,
  getDesignerDropZone,
  getPaletteGroups,
} from '../support/app.po';

describe('@luban-ui/luban-ui-e2e', () => {
  beforeEach(() => cy.visit('/'));

  it('should render designer palette and drop zone', () => {
    getDesignerRoot().should('exist');
    getDesignerPalette().should('exist');
    getDesignerDropZone().should('exist');
    getPaletteGroups().should('have.length.at.least', 1);
  });
});

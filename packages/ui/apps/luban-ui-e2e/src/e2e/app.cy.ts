import {
  getLayoutCards,
  getPageTitle,
  getPrimaryButton,
} from '../support/app.po';

describe('@luban-ui/luban-ui-e2e', () => {
  beforeEach(() => cy.visit('/'));

  it('should render layout and primary button', () => {
    getPageTitle().should('contain.text', 'Luban UI 低代码设计器');
    getLayoutCards().should('have.length', 2);
    getPrimaryButton().should('contain.text', '主按钮').click();
  });
});

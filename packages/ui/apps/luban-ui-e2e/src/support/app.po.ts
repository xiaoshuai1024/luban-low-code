export const getPageTitle = () => cy.get('[data-cy="page-title"]');
export const getPrimaryButton = () =>
  cy.get('[data-cy="primary-contained-btn"]');
export const getLayoutCards = () => cy.get('[data-cy^="layout-card-"]');

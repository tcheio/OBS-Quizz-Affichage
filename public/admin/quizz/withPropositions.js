// Quiz avec propositions : ex. 1, 2, 4, 6, 7, 8(?)
// Affiche contrôles généraux + bouton "Afficher propositions"

export function withPropositions(context) {
  const { sendText } = context;

  return {
    controls: {
      general: true,
      thematique: false,
      showProps: true,
    },
    showProps() {
      sendText(JSON.stringify({ action: 'showPropositions' }));
    },
    validate() {
      sendText(JSON.stringify({ action: 'valider' }));
    },
    rond() {/* non pertinent */},
    carre() {/* non pertinent */},
  };
}

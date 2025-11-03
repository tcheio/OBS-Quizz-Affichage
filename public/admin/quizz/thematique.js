// Quiz thématique : ex. "3 - questionThématique"
// Affiche contrôles généraux + contrôles thématiques (rond/carré), sans bouton propositions

export function thematique(context) {
  const { sendText } = context;

  return {
    controls: {
      general: true,
      thematique: true,
      showProps: false,
    },
    validate() {
      sendText(JSON.stringify({ action: 'valider' }));
    },
    rond() {
      sendText(JSON.stringify({ action: 'showRond' }));
    },
    carre() {
      sendText(JSON.stringify({ action: 'showCarre' }));
    },
    showProps() {/* non pertinent */},
  };
}

// Finale : ex. "8 - questionFinale"
// Affiche contrôles généraux, sans bouton propositions

export function finale(context) {
  const { sendText } = context;

  return {
    controls: {
      general: true,
      thematique: false,
      showProps: false,
    },
    validate() {
      sendText(JSON.stringify({ action: 'valider' }));
    },
    showProps() {/* non pertinent */},
    rond() {/* non pertinent */},
    carre() {/* non pertinent */},
  };
}
// ╔══════════════════════════════════════════════════╗
// ║  SongVote — Configuratie                         ║
// ║  Pas deze waarden aan voor jouw band             ║
// ╚══════════════════════════════════════════════════╝

const CONFIG = {
  // GitHub instellingen
  GH_OWNER:     'ivomom-ux',  // bv. 'ivomom-ux'
  GH_REPO:      'songvote-HotStew',         // bv. 'songvote-HotStew'
  GH_TOKEN:     'GH_TOKEN',  // Injected at deploy time from GitHub Secret 'GH_TOKEN' — never commit a real value here
  GH_DATA_FILE: 'songvote_data.json',           // bestandsnaam in de repo

  // Naam van de beheerder (krijgt import/export/gebruikersbeheer)
  ADMIN_USER:   'Ivo - trombone',
};

UPDATE "AppSetting"
SET "emailTemplate" = E'Bonjour {{payeur}},\n\nNous vous contactons concernant l’adhésion de {{adherent}}.\n\nAprès examen du dossier, certaines informations ou pièces justificatives doivent être complétées afin de finaliser l’adhésion :\n\n{{anomalies}}\n\nNous vous remercions de bien vouloir répondre à cet e-mail en nous transmettant les éléments demandés.\n\nCordialement,\n\nL’équipe La Sportive'
WHERE "emailTemplate" IN (
  E'Bonjour {{prenom}},\n\nNous avons vérifié votre inscription. Merci de répondre à ce message avec les corrections suivantes :\n\n{{anomalies}}\n\nBien sportivement,\nLa Sportive',
  E'Bonjour {{prenom}},\n\nMerci de corriger :\n{{anomalies}}\n\nBien sportivement,\nLa Sportive'
);

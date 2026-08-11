UPDATE "FieldMapping"
SET "sourceKey" = CASE label
  WHEN 'Prénom' THEN 'firstName'
  WHEN 'Nom' THEN 'lastName'
  WHEN 'E-mail de contact' THEN 'contactEmail'
  WHEN 'Adresse' THEN 'Adresse postale complète'
  WHEN 'Attestation de santé / certificat médical' THEN 'Attestation de santé complétée ou, si une réponse « Oui » est cochée au questionnaire de santé, certificat médical établi par un médecin.'
  ELSE "sourceKey"
END
WHERE label IN ('Prénom', 'Nom', 'E-mail de contact', 'Adresse', 'Attestation de santé / certificat médical');

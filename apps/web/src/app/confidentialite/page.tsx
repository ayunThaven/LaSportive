import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Règles de confidentialité · La Sportive" };

export default function PrivacyPage() {
  return <LegalPage title="Règles de confidentialité" introduction="La Sportive est un outil de gestion interne réservé aux membres habilités du bureau de l’association. Les adhérents n’ont pas accès à l’application, même lorsque leurs données y sont traitées.">
    <section><h2>1. Responsabilité et personnes concernées</h2>
      <p>L’association qui utilise La Sportive est responsable des traitements effectués pour sa gestion associative. Le bureau organise les accès et veille à la confidentialité des informations. Toute question relative aux données doit être adressée à la présidence de l’association, par ses coordonnées habituelles de contact.</p>
      <p>Les données peuvent concerner les adhérents, leurs représentants légaux, les payeurs, les contacts d’urgence et les membres du bureau utilisateurs de l’outil. Cette page décrit le fonctionnement interne ; le bureau doit également informer les personnes concernées lors de la collecte, notamment dans les formulaires d’adhésion.</p></section>
    <section><h2>2. Données utilisées et finalités</h2>
      <p>Selon les champs de la campagne HelloAsso et les documents nécessaires au dossier, l’application permet de traiter :</p>
      <ul><li>L’identité, les coordonnées et les informations d’inscription, pour suivre les adhésions et préparer les licences.</li>
        <li>Les informations de cotisation, de paiement et de réduction, pour le suivi administratif et comptable.</li>
        <li>Les autorisations, contacts d’urgence et justificatifs nécessaires, pour vérifier les dossiers et préparer l’encadrement des activités.</li>
        <li>Les corrections, anomalies, statuts et relances, pour assurer le suivi des dossiers.</li>
        <li>Les informations de session et journaux techniques, pour permettre l’accès et le fonctionnement de l’application.</li></ul>
      <p>Les membres du bureau doivent limiter les informations saisies et les documents importés à ce qui est nécessaire. Les données relatives à la santé, lorsqu’elles sont indispensables, nécessitent une justification spécifique et des précautions renforcées ; aucun détail médical superflu ne doit être ajouté aux commentaires.</p></section>
    <section><h2>3. Fondements des traitements</h2>
      <p>La gestion de l’adhésion repose sur l’exécution de la relation d’adhésion. Le respect des obligations comptables repose sur les obligations légales applicables à l’association. La sécurité de l’outil et l’organisation du suivi administratif relèvent de l’intérêt légitime de l’association à gérer et protéger ses activités, sous réserve des droits des personnes.</p>
      <p>Les usages facultatifs qui le nécessitent, tels que certaines utilisations de l’image, reposent sur une autorisation ou un consentement distinct. L’accès à l’application ne vaut pas consentement des adhérents. Le bureau doit déterminer la condition juridique applicable avant tout traitement de données de santé.</p></section>
    <section><h2>4. Accès et services connectés</h2>
      <p>L’accès à l’application est réservé aux membres du bureau habilités, dans la limite de leurs missions. Le compte partagé ne doit être communiqué ni aux adhérents, ni aux bénévoles ou intervenants extérieurs au bureau.</p>
      <p>HelloAsso fournit les informations d’inscription. Si ces connexions sont configurées, Google Drive reçoit les justificatifs déposés depuis l’outil et Brevo reçoit les informations nécessaires à l’envoi des relances. Les prestataires d’hébergement et de base de données interviennent pour le fonctionnement technique. Les données nécessaires aux licences ou aux aides ne doivent être transmises qu’aux organismes concernés et par les personnes habilitées.</p>
      <p>Le bureau doit vérifier les contrats, lieux de traitement et garanties des prestataires utilisés, notamment en cas de transfert hors de l’Espace économique européen. La configuration des services connectés ne constitue pas à elle seule une garantie de localisation des données.</p></section>
    <section><h2>5. Conservation des informations</h2>
      <p>Les dossiers sont conservés en gestion courante pendant la période nécessaire au suivi de l’adhésion, de la saison et à la clôture des démarches associées. Les pièces soumises à une obligation légale ou nécessaires à la défense des droits de l’association doivent ensuite être archivées avec un accès restreint pendant la durée applicable ; les autres données doivent être supprimées ou anonymisées lorsqu’elles ne sont plus utiles.</p>
      <p>Le bureau définit les durées par catégorie de données et organise leur application, y compris pour les exports, les documents Google Drive et les sauvegardes. La fin d’une saison ou la déconnexion d’un service ne signifie pas que les données ont été supprimées automatiquement.</p></section>
    <section><h2>6. Sécurité et cookie de session</h2>
      <p>L’authentification utilise un cookie technique nommé « la_sportive_session », d’une durée maximale de huit heures. Il sert à maintenir la connexion. L’application n’intègre pas de traceur publicitaire ou de mesure d’audience.</p>
      <p>Chaque utilisateur doit protéger les identifiants partagés, verrouiller son poste, se déconnecter après utilisation et conserver les exports uniquement dans les espaces autorisés par l’association. Tout accès suspect, perte de document ou envoi au mauvais destinataire doit être signalé immédiatement à la présidence et à l’administrateur.</p></section>
    <section><h2>7. Droits et contact</h2>
      <p>Les personnes concernées peuvent demander à la présidence l’accès à leurs données, leur rectification, leur effacement ou la limitation de leur traitement. Selon le fondement du traitement, elles disposent également d’un droit d’opposition, de portabilité et de retrait du consentement. Ces droits s’exercent dans les conditions prévues par la réglementation, notamment sous réserve des obligations de conservation.</p>
      <p>Il n’est pas nécessaire de disposer d’un accès à La Sportive pour exercer ces droits. Le bureau transmet les demandes à la personne chargée de les traiter ; une réponse est apportée en principe sous un mois, avec prolongation possible dans les conditions légales.</p>
      <p>Une réclamation peut être adressée à la <a href="https://www.cnil.fr/fr/adresser-une-plainte">CNIL</a>. Consultez également les <a href="https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence">informations de la CNIL sur la transparence des traitements</a>.</p></section>
  </LegalPage>;
}

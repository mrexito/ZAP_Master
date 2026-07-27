import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { LegalPageModel } from '@/types/marketing'
import { buildPageMetadata } from '@/lib/seo'
import { Section } from '@/app/components/layout/section'
import { LegalPageContent } from '@/app/components/marketing/legal-page-content'

// Abschnitt 9.1, "skip legal review" (22.07.2026, wie bei Impressum/Datenschutz): Betreiber hat
// eine Konkurrenz-AGB als Vorlage vorgegeben und mehrere Korrekturen ausdrücklich angeordnet:
// - Vertragspartei überall (nicht nur im ersten Satz -- die Vorlage nannte im
//   Vertragsparteien-Absatz weiterhin die tatsächliche Konkurrenzfirma) auf "Lernecke Zürich GmbH"
//   korrigiert.
// - Stripe-Zahlungsabschnitt entfernt.
// - Die Klausel zur Drittanbieter-Materialpartnerschaft ("modular lernen" in der Vorlage -- eine
//   real existierende, aber nicht Lerneckes eigene Firma) durch den tatsächlichen Partner "yondy"
//   (https://www.yondy.ch/) ersetzt, nachdem der Betreiber diese Partnerschaft ausdrücklich
//   bestätigt hat.
// Zusätzlich, unaufgefordert aber konsistent mit einem bereits geäusserten Vorbehalt, eine weitere
// Stelle bereinigt: Die Klausel zur Kursplattform verwies namentlich auf "Google Workspace/Google
// Classroom"; diese Plattform nutzt dieses Projekt nicht. Auf "unsere digitale Kursplattform"
// verallgemeinert statt eine falsche Technologie-Behauptung zu übernehmen. Der übrige Teil des
// ursprünglichen "Kauf von Material"-Abschnitts (Lernkarten-Verkauf/-Versand/-Rücksendung als
// Lerneckes eigenes Produkt) bleibt weiterhin aussen vor -- nur die Yondy-Partnerschaft wurde vom
// Betreiber bestätigt, der Eigenverkauf physischer Lernkarten nicht.
// Alle übrigen internen Geschäftsbedingungen (Stornogebühren-Staffel, Mahngebühr, Kündigungsrechte
// etc.) unverändert aus der Vorlage übernommen -- das sind Lerneckes eigene Vertragsentscheidungen,
// keine Tatsachenbehauptungen über Dritte, und liegen in der Verantwortung des Betreibers.
const agbModel: LegalPageModel = {
  title: 'Allgemeine Geschäftsbedingungen',
  updatedAt: '2026-07-22',
  sections: [
    {
      id: 'geltungsbereich',
      title: 'Geltungsbereich',
      groups: [
        {
          id: 'geltungsbereich-text',
          items: [
            'Mit einer Anmeldung (elektronisch, per E-Mail oder telefonisch) anerkennen Sie die Allgemeinen Geschäftsbedingungen (AGBs) von Lernecke Zürich GmbH und nehmen diese an. Mit der Angabe von persönlichen Daten via Kontakt- oder Anmeldeformular anerkennen Sie auch unsere Datenschutzerklärung.',
          ],
        },
      ],
    },
    {
      id: 'kursangebot',
      title: 'Kursangebot auf der Website',
      groups: [
        {
          id: 'kursangebot-text',
          items: [
            'Wir aktualisieren unsere Website laufend und sorgfältig – dennoch können aber Fehler entstehen, wie z.B. unrichtige Kurszeiten, Kursdaten, Kursort, Preise und Details betr. Kursinhalt. Verbindlich sind die angegebenen Informationen, welche wir Ihnen jeweils immer mit der definitiven Kursbestätigung nach der Anmeldung mitsenden. Dennoch können auch hier kurzfristig Abweichungen entstehen betr. Kurszeit, Kursdatum, Kursort oder Kursinhalt – wir werden uns aber immer bemühen, Ihnen einen möglichst geeigneten Ersatz zur Verfügung zu stellen.',
          ],
        },
      ],
    },
    {
      id: 'kursanmeldung',
      title: 'Kursanmeldung',
      groups: [
        {
          id: 'kursanmeldung-text',
          items: [
            'Die Kursanmeldung erfolgt im Normalfall elektronisch via Anmeldeformular auf unserer Website. In Ausnahmefällen können Sie sich auch telefonisch nach einem Beratungsgespräch oder per E-Mail anmelden. Sie können gerne ein kostenloses, telefonisches Beratungsgespräch vereinbaren (via Kontaktformular). Eine Anmeldung ist erst gültig nach einer Anmeldebestätigung durch uns via E-Mail oder Post. Sollten Sie nach einer elektronischen Anmeldung via Anmeldeformular keine Rückmeldung von uns erhalten, liegt es in Ihrer Verantwortung, uns nochmals zu kontaktieren. Wir bemühen uns stets um einen schnellstmöglichen Bescheid. Es besteht kein Anspruch auf eine Kursteilnahme. Wir behalten uns vor, Schüler/innen / Rechnungsempfänger/innen, bei welchen wir schlechte Erfahrungen gemacht haben, von zukünftigen Kursteilnahmen auszuschliessen.',
          ],
        },
      ],
    },
    {
      id: 'vertrag',
      title: 'Zustandekommen des Vertrages',
      groups: [
        {
          id: 'vertrag-text',
          items: [
            'Mit dem Übermitteln der elektronischen Anmeldung (via Anmeldeformular auf unserer Website) verpflichten Sie sich, am Kurs teilzunehmen und die vereinbarten Kursgebühren zu bezahlen. Bei der Anmeldung via Anmeldeformular handelt es sich um ein rechtsverbindliches Angebot Ihrerseits. Unsererseits kommt ein Vertrag zustande, sobald Sie eine Bestätigungsmail von uns erhalten haben.',
            'Parteien des Vertrages sind einerseits die Lernecke Zürich GmbH, sowie andererseits der Elternteil bzw. die Elternteile, der oder die das Kind für den Kurs anmeldet bzw. anmelden (Vertrag zugunsten Dritter).',
          ],
        },
      ],
    },
    {
      id: 'zahlungsbedingungen',
      title: 'Zahlungsbedingungen und Zahlungsverzug',
      groups: [
        {
          id: 'zahlungsbedingungen-text',
          items: [
            'Mit der Anmeldebestätigung erhalten Sie eine Rechnung – bei Minderjährigen auf den Namen der Eltern. Darauf finden Sie den entsprechenden Zahlungstermin. In jedem Fall ist eine Zahlung vor Kursbeginn erforderlich. Ansonsten behalten wir uns vor, Sie/Ihr Kind vom Kurs auszuschliessen. In Ausnahmefällen kann bei guter Bonität eine Ratenzahlung beantragt werden – es besteht jedoch keinen Anspruch auf eine Ratenzahlung. Die Lehrperson behält sich vor, dass bei Kursantritt eine elektronische Zahlungsbestätigung verlangt werden kann, damit das Kind am Kurs teilnehmen kann. Auf der Rechnung finden Sie die entsprechend akzeptierten Zahlungsmittel.',
            'Bei Zahlungsverzug wird eine Pauschale von CHF 40.– für Mahnspesen fällig. Wir behalten uns zudem vor, dass bei Zahlungsverzug ein externes Inkassobüro beauftragt wird. Kosten für zusätzliche Aufwände bezahlt stets der Kunde.',
          ],
        },
      ],
    },
    {
      id: 'abmeldung',
      title: 'Abmeldung',
      groups: [
        {
          id: 'abmeldung-text',
          items: [
            'Eine Anmeldung über unser elektronisches Anmeldeformular auf der Website ist verbindlich und kann grundsätzlich nicht mehr annulliert werden. Bei einer irrtümlichen Anmeldung müssen Sie sich nachweislich per E-Mail an lerneckezueri@gmail.com innert 24 Stunden wieder abmelden; ansonsten werden grundsätzlich keine Stornierungen mehr entgegengenommen. Bitte kontrollieren Sie daher bei Anmeldung im Anmeldeformular den gewählten Kurs (Datum, Zeiten, etc.). Falls bei der Anmeldung etwas unklar ist, informieren Sie sich bitte bei uns oder treten Sie mit uns in Kontakt.',
            'Beratungsgespräche vor einer Anmeldung sind stets unverbindlich und die Entscheidung über eine entsprechende Kurswahl liegt letztendlich immer beim Kunden. Bei Unsicherheiten raten wir Ihnen kürzere Kurse zu besuchen.',
            'Für jede Änderung erhalten Sie eine schriftliche Bestätigung per E-Mail – mündliche Abmachungen über Änderungen haben grundsätzlich keine Gültigkeit.',
            'Eine Abmeldung / Stornierung ist grundsätzlich nicht möglich - sollten Sie oder Ihr Kind sich trotzdem abmelden oder nicht am Kurs erscheinen, gilt grundsätzlich folgende Regelung (unabhängig ob verschuldet oder unverschuldet, z.B. durch Verspätung öffentlicher Verkehrsmittel, Krankheit mit Arztzeugnis, etc.):',
          ],
        },
        {
          id: 'abmeldung-kosten',
          subhead: 'Kosten',
          items: [
            '30 Tage vor Kursbeginn: 10% der Kurskosten als Entschädigung / Bearbeitungsgebühr',
            '29–14 Tage vor Kursbeginn: 30% der Kurskosten',
            '13–5 Tage vor Kursbeginn: 60% der Kurskosten',
            '4 Tage–24h vor Kursbeginn: 80% der Kurskosten',
            'Nichterscheinen bei Kursbeginn / Abmeldung kurzfristiger als 24h vor Kursbeginn: 100% der Kurskosten',
            'Nicht-Teilnahme wegen unbezahlter Rechnung: 100% der Kurskosten',
          ],
        },
      ],
    },
    {
      id: 'kuendigung',
      title: 'Kündigung durch uns',
      groups: [
        {
          id: 'kuendigung-text',
          items: [
            'Aus wichtigen Gründen behalten wir uns vor, den Vertrag jederzeit fristlos zu kündigen und den/die Schüler/in vom Kurs auszuschliessen. Als wichtiger Grund zählt insbesondere schlechtes Verhalten, welches die Lehrperson, die Kursatmosphäre oder einzelne Mitschüler/innen in erheblichem Masse stört. Bei einer Kündigung aus einem solchen Grund besteht kein Rückerstattungsanspruch der Kurskosten. Selbstverständlich werden die Eltern betroffener Schüler/innen frühzeitig vorgewarnt, sodass mit ihnen gesprochen werden kann und sie die Möglichkeit bekommen, durch Besserung des Verhaltens dennoch weiterhin am Kurs teilnehmen zu können.',
            'Den Lehrpersonen ist es aus wichtigen Gründen auch vorbehalten, Schüler/innen frühzeitig von den Kursen nach Hause zu schicken. Wichtige Gründe sind dieselben wie oben genannt. In einem solchen Fall besteht kein Rückerstattungsanspruch der verlorenen Kurszeit und die Eltern werden im Nachhinein informiert, ob das Kind den Kurs dennoch weiterhin besuchen kann. Selbstverständlich werden die Eltern in einem solchen Fall sofort telefonisch kontaktiert, sodass diese die Möglichkeit haben, das Kind abzuholen.',
            'Des Weiteren ist es uns auch vorbehalten, den Vertrag aus Gründen von Meinungsverschiedenheiten und Konfliktsituationen mit Eltern oder Schüler/innen jederzeit fristlos zu kündigen - ohne Nennung von besonderen Gründen. In einem solchen Fall werden Ihnen die offenen Kurslektionen proportional zu den Gesamtkosten zurückerstattet.',
          ],
        },
      ],
    },
    {
      id: 'absage-teilnehmerzahl',
      title: 'Absage aufgrund zu geringer Teilnehmerzahl',
      groups: [
        {
          id: 'absage-teilnehmerzahl-text',
          items: [
            'Wir behalten uns vor, Kurse bis 30 Tage vor Kursbeginn aufgrund zu geringer Teilnehmerzahl abzusagen - trotz vorgängig schriftlich versendeter Kursbestätigung. In diesem Fall entstehen den Kursteilnehmern keinerlei Kurskosten - die bezahlte Kursgebühr wird Ihnen vollumfänglich zurückerstattet.',
            'Selbstverständlich informieren wir Sie im Falle einer Absage über alternative Kursdaten / Kursangebote und sind sehr bemüht, Ihnen dennoch eine passende, alternative Lösung anbieten zu können.',
            'Im Falle einer Nichtdurchführung eines Kurses haben Sie keinerlei Schadensersatzansprüche gegenüber uns.',
          ],
        },
      ],
    },
    {
      id: 'kursort',
      title: 'Änderung Kursort',
      groups: [
        {
          id: 'kursort-text',
          items: [
            'Wir behalten uns vor, den auf der Anmeldebestätigung genannten Kursort kurzfristig zu ändern. In diesem Falle sind wir selbstverständlich sehr bemüht, eine passende Alternative zu finden.',
          ],
        },
      ],
    },
    {
      id: 'krankheit-lehrperson',
      title: 'Absage aufgrund Krankheit Lehrperson',
      groups: [
        {
          id: 'krankheit-lehrperson-text',
          items: [
            'Wir halten Kontinuität in einer persönlichen Betreuung und Begleitung der Schüler und Schülerinnen für einen wichtigen Erfolgsfaktor. Trotzdem kann es vorkommen, dass eine Lehrperson kurzfristig verhindert ist. In diesem Fall sorgen wir entweder für eine geeignete Stellvertretung oder wir müssen einzelne Kurstage kurzfristig verschieben. Bei einer Absage/Verschiebung werden wir die ausgefallenen Kurse vollumfänglich nachholen, sobald die zuständige Lehrperson wieder einsatzbereit ist oder eine geeignete Stellvertretung gefunden werden konnte. Das Nachholdatum wird von der Lehrperson festgelegt. Wir sind sehr bemüht, für alle eine passende Lösung zu finden. Jedoch können wir nicht garantieren, dass der Nachholtermin allen Personen passt. In diesem Fall besteht kein Anspruch der Kursteilnehmer auf ein erneutes Verschieben oder ein anderes Nachholdatum. Sollte eine zuständige Lehrperson längerfristig oder dauerhaft ausfallen, sind wir selbstverständlich sehr bemüht, eine geeignete Alternative zu organisieren – z.B. Stellvertretung oder Umstellung auf Fernunterricht. Sie haben jedoch keine Ansprüche auf Schadenersatz.',
          ],
        },
      ],
    },
    {
      id: 'hoehere-gewalt',
      title: 'Absage aufgrund höherer Gewalt oder behördlicher Anordnung',
      groups: [
        {
          id: 'hoehere-gewalt-text',
          items: [
            'Sollten unsere Kurse aufgrund höherer Gewalt oder behördlicher Anordnung (z.B. Epidemie/Pandemie) nicht physisch vor Ort durchgeführt werden können, werden wir auf Distance Learning (Fernunterricht) umstellen. In einem solchen Fall werden die Kurse online fortgeführt – unsere Lehrpersonen sind hierzu bestens ausgerüstet. Es kann bei der Umstellung aber aus organisatorischen Gründen zu einzelnen Änderungen kommen, wie z.B. Kurszeiten, Änderungen der Gruppe, Lehrperson. Bei einer Änderung aufgrund höherer Gewalt oder behördlicher Anordnung besteht keine Möglichkeit auf Rückforderung oder Schadenersatz. Wir bemühen uns stets, Ihr Kind auch während einer besonderen Lage optimal auf dem Weg ins Gymnasium zu begleiten.',
            'Sollte die zentrale Aufnahmeprüfung verschoben oder abgesagt werden, wird der Kurs dennoch fortgeführt und es besteht kein Anrecht auf Rückerstattung. Wir sind überzeugt, dass Ihr Kind dennoch viel von unseren Kursen profitieren kann.',
          ],
        },
      ],
    },
    {
      id: 'absenzen',
      title: 'Absenzen',
      groups: [
        {
          id: 'absenzen-text',
          items: [
            'Für den Erfolg des Kindes ist es wichtig, dass die Kurse regelmässig besucht werden. Bei Absenzen gibt es keine Reduktion der Kurskosten.',
            'Sollte Ihr Kind dennoch fehlen, bitten wir Sie, die Lehrperson möglichst frühzeitig zu informieren, damit zusammen mit der Lehrperson abgestimmt werden kann, was nachgeholt werden sollte.',
          ],
        },
      ],
    },
    {
      id: 'reklamationen',
      title: 'Reklamationen und Gruppeneinteilung',
      groups: [
        {
          id: 'reklamationen-text',
          items: [
            'Sollten Sie unzufrieden sein, ein Feedback geben wollen oder Anregungen haben, bitten wir Sie, uns frühzeitig, offen und konstruktiv zu kontaktieren. Wir sind stets bemüht, unseren Unterricht noch besser zu gestalten.',
            'Sollte sich Ihr Kind in der Klasse unwohl fühlen, bitten wir Sie, mit uns in Kontakt zu treten. Auch wenn wir grundsätzlich keine Umteilung garantieren können, werden wir sehr bemüht sein, eine optimale Lösung für das Kind zu finden.',
          ],
        },
      ],
    },
    {
      id: 'lehrmaterial',
      title: 'Lehrmaterial',
      groups: [
        {
          id: 'lehrmaterial-text',
          items: [
            'In den Kursen sind Übungs-, Lehr- und Lösungsmaterial vollumfänglich inbegriffen.',
            'Es ist untersagt, das Kursmaterial ohne ausdrückliche, nachweisliche Erlaubnis von uns an Dritte weiterzugeben oder zu vervielfältigen.',
            'Für die Richtigkeit und Vollständigkeit des Kursmaterials übernehmen wir keine Gewährleistung und keine Haftung. Ebenfalls übernehmen wir weder Gewährleistung noch Haftung für die Richtigkeit und Vollständigkeit der im Kurs mündlich besprochenen Themengebiete.',
            'Mit der Anmeldung stimmen Sie als Eltern zu, dass Ihr Kind unsere digitale Kursplattform nutzen darf.',
          ],
        },
      ],
    },
    {
      id: 'urheberrecht',
      title: 'Urheberrecht',
      groups: [
        {
          id: 'urheberrecht-text',
          items: [
            'Wir behalten uns sämtliche Rechte an von uns entwickelten Materialien, Lösungen, Plänen, etc. vor.',
            'Es ist ohne ausdrückliche, nachweisbare Erlaubnis durch uns nicht gestattet, Kursmaterial und weitere Materialien von uns zu kopieren, zu vervielfältigen, auszuleihen oder an Dritte weiterzugeben.',
          ],
        },
      ],
    },
    {
      id: 'nicht-bestehen',
      title: 'Nicht-Bestehen der Prüfung',
      groups: [
        {
          id: 'nicht-bestehen-text',
          items: [
            'Auch wenn wir sehr bemüht sind, einen qualitativ hochwertigen und erfolgsorientierten Gymivorbereitungskurs anzubieten und das Kind optimal auf die Prüfung vorzubereiten, können wir ein tatsächliches Bestehen der Prüfung nicht garantieren. Im Falle eines Nicht-Bestehens beraten wir Sie aber bei Bedarf selbstverständlich über mögliche weitere Schritte des Kindes. In keinem Fall aber übernehmen wir eine Gewährleistung oder Haftung für den Fall des Nicht-Bestehens der Aufnahmeprüfung; es bestehen insbesondere keinerlei Schadenersatz- oder andere Ansprüche.',
          ],
        },
      ],
    },
    {
      id: 'lehrpersonen',
      title: 'Lehrpersonen',
      groups: [
        {
          id: 'lehrpersonen-text',
          items: [
            'Die Auswahl geeigneter Lehrpersonen hat für uns oberste Priorität. Sollten Sie mit der Lehrperson nicht zufrieden sein, bitten wir Sie ausdrücklich, sich frühzeitig schriftlich mit uns in Verbindung zu setzen. Solange Sie uns kein negatives Feedback geben, gehen wir davon aus, dass Sie mit der Lehrperson zufrieden sind.',
            'Wir wählen unsere Lehrpersonen sehr sorgfältig aus und führen laufend diverse Qualitätsbeurteilungen durch. Einige Lehrpersonen können sich noch in der Ausbildung / im Studium befinden. Wir weisen Sie darauf hin, dass wir jede Gewährleistung oder Haftung aufgrund der Auswahl unserer Lehrpersonen oder aufgrund von Handlungen oder Unterlassungen derselben ablehnen; es bestehen insbesondere keinerlei Schadenersatz- oder andere Ansprüche.',
          ],
        },
      ],
    },
    {
      id: 'drittanbieter-lernmaterial',
      title: 'Zusammenarbeit mit Drittanbietern',
      groups: [
        {
          id: 'drittanbieter-lernmaterial-text',
          items: [
            'Wir arbeiten mit der Partnerfirma "yondy" (https://www.yondy.ch/) zusammen. Bestellen Sie Lern- oder Übungsmaterial von yondy auf unserer Website, übernehmen wir ausdrücklich keinerlei Gewährleistung oder Haftung; es bestehen insbesondere keinerlei Schadenersatz- oder andere Ansprüche. Sie gehen eine direkte Vertragsbeziehung mit yondy ein und erklären sich beim Kauf automatisch mit deren AGBs einverstanden. Wir haben keinen Einfluss auf Versand, Inhalt oder andere Bestandteile von Materialien von yondy.',
          ],
        },
      ],
    },
    {
      id: 'weiteres',
      title: 'Weiteres',
      groups: [
        {
          id: 'weiteres-text',
          items: [
            'Falls einzelne Bestimmungen dieser Allgemeinen Geschäftsbedingungen unwirksam oder ungültig sein (oder werden) sollten, wird dadurch die Wirksamkeit der übrigen Bestimmungen nicht berührt.',
            'Lernecke behält sich das Recht vor, diese AGB zu ergänzen oder zu verändern und anschliessend neu zu veröffentlichen.',
            'Jeder Kunde von Lernecke bestätigt hiermit, dass er die vorliegenden AGB gelesen, verstanden und akzeptiert hat.',
          ],
        },
      ],
    },
    {
      id: 'anwendbares-recht',
      title: 'Anwendbares Recht und Gerichtsstand',
      groups: [
        {
          id: 'anwendbares-recht-text',
          items: ['Es gilt das schweizerische Recht. Gerichtsstand ist Zürich.'],
        },
      ],
    },
  ],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: agbModel.title,
    description: 'Allgemeine Geschäftsbedingungen für Kursbuchungen auf dieser Lernplattform.',
    path: '/agb',
    locale,
  })
}

export default async function AgbPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Section spacing="default">
      <LegalPageContent model={agbModel} />
    </Section>
  )
}

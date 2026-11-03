export const storigamInterestLanguages = [
  "en", "ja", "es", "tr", "fr", "de", "pt", "ko", "zh", "ru", "ar", "it",
] as const;

export type StorigamInterestLanguage = typeof storigamInterestLanguages[number];

const templates: Record<StorigamInterestLanguage, { subject: string; text: string }> = {
  en: {
    subject: "Welcome to the Storigam Beta Programme! 💜",
    text: `Hi {{name}},

Welcome to the Storigam Beta Programme! 💜

We’re excited to have you with us as we take Storigam one step closer to launch.

You’re now part of a special group helping shape a new way to turn gaming moments into stories worth keeping.

What happens next?

Shortly, we’ll send you everything you need to get started, including your beta perks and benefits, instructions on how to download the app, and how to participate in the programme and share your feedback.

For now, sit tight. Your Storigam journey is just beginning!

Have any questions or suggestions? We’d love to hear from you. Reach us anytime at support@storigam.com.

Thank you for being part of our story.

Warmly,
Team Storigam
Stories made by gamers.

You received this because you asked to hear about the Storigam beta. To stop future updates, unsubscribe here: {{unsubscribeUrl}}`,
  },
  ja: {
    subject: "Storigamベータプログラムへようこそ！💜",
    text: `{{name}}さん、こんにちは！

Storigamベータプログラムへようこそ！💜

Storigamの正式リリースに向けて、一緒に歩んでいただけることを嬉しく思います。

あなたは、ゲームの瞬間を大切に残せる物語へ変える新しい方法を一緒につくる、特別なグループの一員です。

これからの流れ

まもなく、ベータ版の特典やメリット、アプリのダウンロード方法、プログラムへの参加方法、フィードバックの送り方など、始めるために必要な情報をお送りします。

それまでは、どうぞ楽しみにお待ちください。Storigamでの旅は始まったばかりです！

質問や提案があれば、ぜひお聞かせください。support@storigam.com までいつでもご連絡いただけます。

私たちの物語に参加してくださり、ありがとうございます。

心を込めて
Team Storigam
ゲーマーが紡ぐストーリー。

このメールはStorigamベータ版の案内を希望された方にお送りしています。今後の案内を停止するには、こちらから配信停止してください：{{unsubscribeUrl}}`,
  },
  es: {
    subject: "¡Te damos la bienvenida al programa beta de Storigam! 💜",
    text: `Hola {{name}},

¡Te damos la bienvenida al programa beta de Storigam! 💜

Nos alegra que te unas a nosotros para acercar Storigam un paso más a su lanzamiento.

Ahora formas parte de un grupo especial que ayudará a dar forma a una nueva manera de convertir momentos de juego en historias que merece la pena conservar.

¿Qué pasa ahora?

Muy pronto te enviaremos todo lo que necesitas para empezar: tus ventajas de la beta, instrucciones para descargar la aplicación y cómo participar en el programa y compartir tus comentarios.

Por ahora, ponte cómodo. ¡Tu aventura en Storigam acaba de empezar!

¿Tienes preguntas o sugerencias? Nos encantará escucharte. Escríbenos cuando quieras a support@storigam.com.

Gracias por formar parte de nuestra historia.

Un saludo,
Equipo Storigam
Historias creadas por gamers.

Recibes este correo porque solicitaste novedades sobre la beta de Storigam. Para dejar de recibir futuras novedades, cancela la suscripción aquí: {{unsubscribeUrl}}`,
  },
  tr: {
    subject: "Storigam Beta Programı’na hoş geldin! 💜",
    text: `Merhaba {{name}},

Storigam Beta Programı’na hoş geldin! 💜

Storigam’ı çıkışına bir adım daha yaklaştırırken aramıza katılmana çok sevindik.

Artık oyun anlarını saklamaya değer hikâyelere dönüştürmenin yeni bir yolunu şekillendirmemize yardımcı olan özel bir grubun parçasısın.

Sırada ne var?

Yakında başlaman için gereken her şeyi göndereceğiz: beta ayrıcalıklarını ve avantajlarını, uygulamayı indirme talimatlarını, programa nasıl katılacağını ve geri bildirimini nasıl paylaşacağını.

Şimdilik rahat ol. Storigam yolculuğun daha yeni başlıyor!

Sorun veya önerin mi var? Seni dinlemek isteriz. Bize istediğin zaman support@storigam.com adresinden ulaşabilirsin.

Hikâyemizin bir parçası olduğun için teşekkürler.

Sevgiler,
Team Storigam
Oyuncuların hikâyeleri.

Bu e-postayı Storigam beta güncellemelerini istediğin için aldın. Gelecekteki güncellemeleri durdurmak için buradan abonelikten çık: {{unsubscribeUrl}}`,
  },
  fr: {
    subject: "Bienvenue dans le programme bêta de Storigam ! 💜",
    text: `Bonjour {{name}},

Bienvenue dans le programme bêta de Storigam ! 💜

Nous sommes ravis de vous compter parmi nous pour rapprocher Storigam de son lancement.

Vous faites désormais partie d’un groupe spécial qui contribue à inventer une nouvelle façon de transformer les moments de jeu en histoires à garder.

Et maintenant ?

Nous vous enverrons bientôt tout ce qu’il faut pour commencer : vos avantages bêta, les instructions pour télécharger l’application, ainsi que les façons de participer au programme et de partager vos retours.

En attendant, profitez de ce moment. Votre aventure avec Storigam ne fait que commencer !

Une question ou une suggestion ? Nous serons ravis de vous lire. Écrivez-nous à tout moment à support@storigam.com.

Merci de faire partie de notre histoire.

Bien chaleureusement,
L’équipe Storigam
Des histoires créées par des gamers.

Vous recevez cet e-mail car vous avez demandé des nouvelles de la bêta Storigam. Pour ne plus recevoir les prochaines actualités, désabonnez-vous ici : {{unsubscribeUrl}}`,
  },
  de: {
    subject: "Willkommen im Storigam-Betaprogramm! 💜",
    text: `Hallo {{name}},

willkommen im Storigam-Betaprogramm! 💜

Wir freuen uns, dass du dabei bist und Storigam gemeinsam mit uns dem Start näherbringst.

Du gehörst jetzt zu einer besonderen Gruppe, die dabei hilft, eine neue Möglichkeit zu gestalten, Gaming-Momente in Geschichten zu verwandeln, die man gern behält.

Wie geht es weiter?

In Kürze schicken wir dir alles, was du für den Einstieg brauchst: deine Beta-Vorteile, eine Anleitung zum Herunterladen der App und Informationen dazu, wie du am Programm teilnehmen und Feedback teilen kannst.

Lehn dich erst einmal zurück. Deine Storigam-Reise beginnt gerade erst!

Fragen oder Vorschläge? Wir freuen uns, von dir zu hören. Schreib uns jederzeit an support@storigam.com.

Danke, dass du Teil unserer Geschichte bist.

Herzliche Grüße
Team Storigam
Geschichten von Gamern.

Du erhältst diese E-Mail, weil du Neuigkeiten zur Storigam-Beta angefordert hast. Hier kannst du dich von zukünftigen Updates abmelden: {{unsubscribeUrl}}`,
  },
  pt: {
    subject: "Boas-vindas ao programa beta do Storigam! 💜",
    text: `Olá, {{name}},

Boas-vindas ao programa beta do Storigam! 💜

Estamos muito felizes por ter você conosco enquanto damos mais um passo em direção ao lançamento do Storigam.

Agora você faz parte de um grupo especial que ajuda a criar uma nova forma de transformar momentos de jogo em histórias que vale a pena guardar.

O que acontece agora?

Em breve, enviaremos tudo o que você precisa para começar: seus benefícios da versão beta, as instruções para baixar o aplicativo e como participar do programa e compartilhar suas sugestões.

Por enquanto, fique à vontade. A sua jornada no Storigam está só começando!

Tem dúvidas ou sugestões? Adoraríamos ouvir você. Fale conosco quando quiser pelo endereço support@storigam.com.

Obrigado por fazer parte da nossa história.

Com carinho,
Equipe Storigam
Histórias feitas por gamers.

Você recebeu este e-mail porque pediu novidades sobre o beta do Storigam. Para deixar de receber futuras atualizações, cancele a inscrição aqui: {{unsubscribeUrl}}`,
  },
  ko: {
    subject: "Storigam 베타 프로그램에 오신 것을 환영합니다! 💜",
    text: `{{name}}님, 안녕하세요!

Storigam 베타 프로그램에 오신 것을 환영합니다! 💜

Storigam의 출시를 한 걸음 더 앞당기는 여정에 함께해 주셔서 기쁩니다.

이제 게임 속 순간을 오래 간직할 이야기로 만드는 새로운 방법을 함께 만들어 갈 특별한 그룹의 일원이 되셨습니다.

다음 단계는 무엇인가요?

곧 시작에 필요한 모든 내용을 보내 드릴게요. 베타 혜택, 앱 다운로드 방법, 프로그램 참여 방법, 의견을 전하는 방법을 안내해 드립니다.

그동안 편하게 기다려 주세요. Storigam에서의 여정은 이제 막 시작됐어요!

궁금한 점이나 제안이 있으신가요? 언제든 support@storigam.com 으로 연락해 주세요.

우리 이야기의 일부가 되어 주셔서 감사합니다.

따뜻한 마음을 담아,
Team Storigam
게이머가 만드는 이야기.

Storigam 베타 소식을 요청하셔서 이 이메일을 받으셨습니다. 앞으로 소식을 받지 않으려면 여기에서 수신을 취소해 주세요: {{unsubscribeUrl}}`,
  },
  zh: {
    subject: "欢迎加入 Storigam 测试计划！💜",
    text: `你好，{{name}}：

欢迎加入 Storigam 测试计划！💜

很高兴与你一起，让 Storigam 离正式上线更近一步。

你现在是特别计划的一员，将帮助我们共同探索一种新方式，把游戏中的瞬间变成值得珍藏的故事。

接下来会怎样？

很快，我们会把开始所需的信息发给你，包括测试版权益、应用下载说明、如何参与计划以及如何分享反馈。

现在请稍作等待。你的 Storigam 旅程才刚刚开始！

有问题或建议吗？我们很乐意听取。欢迎随时通过 support@storigam.com 联系我们。

感谢你成为我们故事的一部分。

诚挚问候，
Storigam 团队
由玩家创造的故事。

你收到此邮件是因为你申请了 Storigam 测试版消息。如不想再收到后续更新，请在此取消订阅：{{unsubscribeUrl}}`,
  },
  ru: {
    subject: "Добро пожаловать в бета-программу Storigam! 💜",
    text: `Здравствуйте, {{name}}!

Добро пожаловать в бета-программу Storigam! 💜

Мы рады, что вы с нами и помогаете приблизить запуск Storigam.

Теперь вы — часть особой группы, которая помогает создать новый способ превращать игровые моменты в истории, которые хочется сохранить.

Что дальше?

Скоро мы отправим всё необходимое для начала: ваши преимущества бета-программы, инструкции по загрузке приложения, а также информацию об участии в программе и отправке отзывов.

А пока можно немного подождать. Ваше путешествие со Storigam только начинается!

Есть вопросы или предложения? Мы будем рады их услышать. Пишите нам в любое время: support@storigam.com.

Спасибо, что стали частью нашей истории.

С теплом,
Команда Storigam
Истории, созданные игроками.

Вы получили это письмо, потому что запросили новости о бета-версии Storigam. Чтобы не получать дальнейшие обновления, отмените подписку здесь: {{unsubscribeUrl}}`,
  },
  ar: {
    subject: "مرحبًا بك في برنامج Storigam التجريبي! 💜",
    text: `مرحبًا {{name}}،

أهلًا بك في برنامج Storigam التجريبي! 💜

يسعدنا انضمامك إلينا ونحن نقترب خطوة أخرى من إطلاق Storigam.

أصبحت الآن جزءًا من مجموعة مميزة تساعد في ابتكار طريقة جديدة لتحويل لحظات اللعب إلى قصص تستحق الاحتفاظ بها.

ما الخطوة التالية؟

سنرسل إليك قريبًا كل ما تحتاج إليه للبدء، بما في ذلك مزايا النسخة التجريبية، وطريقة تنزيل التطبيق، وكيفية المشاركة في البرنامج وإرسال ملاحظاتك.

في الوقت الحالي، استرخِ قليلًا. رحلتك مع Storigam بدأت للتو!

هل لديك أسئلة أو اقتراحات؟ يسعدنا سماعها. تواصل معنا في أي وقت عبر support@storigam.com.

شكرًا لأنك أصبحت جزءًا من قصتنا.

مع أطيب التحيات،
فريق Storigam
قصص يصنعها اللاعبون.

وصلتك هذه الرسالة لأنك طلبت تحديثات النسخة التجريبية من Storigam. لإيقاف التحديثات المستقبلية، ألغِ الاشتراك من هنا: {{unsubscribeUrl}}`,
  },
  it: {
    subject: "Benvenuto/a al programma beta di Storigam! 💜",
    text: `Ciao {{name}},

Benvenuto/a al programma beta di Storigam! 💜

Siamo felici di averti con noi mentre avviciniamo Storigam di un altro passo al lancio.

Ora fai parte di un gruppo speciale che contribuisce a creare un nuovo modo per trasformare i momenti di gioco in storie da custodire.

E adesso?

Tra poco ti invieremo tutto ciò che ti serve per iniziare: i vantaggi della beta, le istruzioni per scaricare l’app e come partecipare al programma e condividere i tuoi feedback.

Per ora, mettiti comodo/a. Il tuo viaggio con Storigam è appena iniziato!

Hai domande o suggerimenti? Ci farà piacere ascoltarli. Scrivici quando vuoi a support@storigam.com.

Grazie per far parte della nostra storia.

Un caro saluto,
Team Storigam
Storie create dai gamer.

Hai ricevuto questa email perché hai richiesto aggiornamenti sulla beta di Storigam. Per non ricevere altri aggiornamenti, annulla l’iscrizione qui: {{unsubscribeUrl}}`,
  },
};

export function normalizeStorigamInterestLanguage(value: unknown): StorigamInterestLanguage {
  if (typeof value !== "string") return "en";
  const locale = value.trim().toLowerCase().split(/[-_]/)[0];
  return storigamInterestLanguages.includes(locale as StorigamInterestLanguage)
    ? locale as StorigamInterestLanguage
    : "en";
}

export function buildStorigamInterestWelcomeEmail(
  name: string,
  language: unknown,
  unsubscribeUrl: string,
) {
  const template = templates[normalizeStorigamInterestLanguage(language)];
  return {
    subject: template.subject,
    text: template.text
      .replace("{{name}}", name)
      .replace("{{unsubscribeUrl}}", unsubscribeUrl),
  };
}

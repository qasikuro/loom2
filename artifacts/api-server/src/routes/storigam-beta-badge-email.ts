import {
  normalizeStorigamInterestLanguage,
  type StorigamInterestLanguage,
} from "./storigam-interest-welcome-email";

const templates: Record<StorigamInterestLanguage, { subject: string; text: string }> = {
  en: {
    subject: "Your Storigam Beta badge — share your idea",
    text: `Hi there,

As one of Storigam’s Beta Users, you’re part of our journey from the very beginning. We want to make that a little more memorable with something created especially for you.

We’re designing exclusive badges reserved for Storigam Beta Users and Founders only. Each badge will be a unique addition to your profile, inspired by your personality, interests, and imagination.

Your idea, your badge

Your badge can be inspired by anything you like. It could be a fantasy creature, an animal, an original character, something from a world you love, or even an object that means something to you. There are no fixed themes, so feel free to be creative.

How it works

1. Share your idea. Reply to this email and tell us what you’d like your badge to feature. You can describe the design, character, theme, or colours you have in mind.

2. We create your badge. Our team will use your idea as inspiration to design something unique for you.

3. Review before it goes live. We’ll send you the finished badge for a one-time review before adding it to your profile, giving you the opportunity to request final adjustments.

A place in Storigam’s history

Your badge will be displayed on your profile in the app and featured on Storigam’s website Hall of Fame, celebrating the people who were part of our journey from the beginning.

These badges are exclusive to Beta Users and Founders. They’re a small way of recognising the people who helped make Storigam what it is today.

Whenever you’re ready, simply reply to this email with your badge idea. We look forward to creating something special for you.

Thank you for being part of Storigam.

Warm regards,
Team Storigam
Stories made by gamers.

Questions? Contact us at support@storigam.com.

You received this because you signed up for Storigam beta updates. To stop future updates, unsubscribe here: {{unsubscribeUrl}}`,
  },
  ja: {
    subject: "Storigamベータ限定バッジ — アイデアをお聞かせください",
    text: `こんにちは。

Storigamのベータユーザーとして、あなたは最初の一歩から私たちの歩みを支えてくださっています。その感謝を、あなたのために作る特別なバッジで形にしたいと考えています。

Storigamのベータユーザーと創設メンバーだけが受け取れる限定バッジを制作しています。一つひとつ、あなたの個性や興味、想像力に着想を得た、プロフィールに加わる特別なアイテムです。

あなたのアイデアを、あなたのバッジに

バッジのモチーフは自由です。空想上の生き物、動物、オリジナルキャラクター、大好きな作品の世界、あるいはあなたにとって大切な物でも構いません。決まったテーマはないので、自由に考えてください。

制作の流れ

1. アイデアを教えてください。このメールに返信して、バッジに取り入れたいものをお知らせください。デザイン、キャラクター、テーマ、色など、思い描いていることを自由に説明してください。

2. バッジを制作します。いただいたアイデアをもとに、チームがあなたのためのデザインを作ります。

3. 公開前に確認できます。プロフィールに追加する前に完成したバッジを一度お送りします。公開前の最終調整をご希望の場合は、その際にお知らせください。

Storigamの歴史に残るバッジ

バッジはアプリのプロフィールに表示され、Storigam公式サイトのHall of Fameにも掲載されます。初期から私たちの歩みに参加してくださった方々を称える場所です。

このバッジはベータユーザーと創設メンバー限定です。Storigamを今の形にするのを支えてくださった皆さんへの、小さな感謝のしるしです。

準備ができたら、このメールに返信してバッジのアイデアをお送りください。あなたのための特別なデザインを作れることを楽しみにしています。

Storigamの一員になってくださり、ありがとうございます。

心を込めて
Team Storigam
ゲーマーが紡ぐストーリー。

ご質問は support@storigam.com までお問い合わせください。

このメールはStorigamベータ版の案内を希望された方にお送りしています。今後の案内を停止するには、こちらから配信停止してください：{{unsubscribeUrl}}`,
  },
  es: {
    subject: "Tu insignia beta de Storigam: comparte tu idea",
    text: `Hola:

Como usuario beta de Storigam, formas parte de nuestro camino desde el principio. Queremos que ese comienzo sea aún más memorable con algo creado especialmente para ti.

Estamos diseñando insignias exclusivas reservadas para los usuarios beta y fundadores de Storigam. Cada una será una pieza única para tu perfil, inspirada en tu personalidad, tus intereses y tu imaginación.

Tu idea, tu insignia

Tu insignia puede inspirarse en cualquier cosa que te guste: una criatura fantástica, un animal, un personaje original, algo de un mundo que te encante o incluso un objeto importante para ti. No hay temas fijos, así que deja volar tu creatividad.

Cómo funciona

1. Comparte tu idea. Responde a este correo y cuéntanos qué te gustaría ver en tu insignia. Puedes describir el diseño, el personaje, el tema o los colores que tienes en mente.

2. Creamos tu insignia. Nuestro equipo tomará tu idea como inspiración para diseñar algo único para ti.

3. Revísala antes de publicarla. Te enviaremos la insignia terminada para que la revises una vez antes de añadirla a tu perfil. Así podrás pedir los últimos ajustes.

Un lugar en la historia de Storigam

Tu insignia aparecerá en tu perfil de la aplicación y también en el Salón de la Fama del sitio web de Storigam, donde celebraremos a quienes formaron parte de nuestro camino desde el comienzo.

Estas insignias son exclusivas para usuarios beta y fundadores. Son una pequeña forma de reconocer a quienes ayudaron a convertir Storigam en lo que es hoy.

Cuando quieras, responde a este correo con tu idea para la insignia. Nos hace mucha ilusión crear algo especial para ti.

Gracias por formar parte de Storigam.

Un cordial saludo,
Equipo Storigam
Historias creadas por gamers.

¿Tienes preguntas? Escríbenos a support@storigam.com.

Recibes este correo porque solicitaste novedades sobre la beta de Storigam. Para dejar de recibir futuras novedades, cancela la suscripción aquí: {{unsubscribeUrl}}`,
  },
  tr: {
    subject: "Storigam Beta rozetin — fikrini paylaş",
    text: `Merhaba,

Storigam Beta Kullanıcılarından biri olarak yolculuğumuzun en başından beri bizimlesin. Senin için özel olarak hazırlayacağımız bir şeyle bu başlangıcı daha da unutulmaz kılmak istiyoruz.

Yalnızca Storigam Beta Kullanıcılarına ve Kurucularına özel rozetler tasarlıyoruz. Her rozet kişiliğinden, ilgi alanlarından ve hayal gücünden ilham alacak ve profiline özgün bir katkı olacak.

Senin fikrin, senin rozetin

Rozetin istediğin her şeyden ilham alabilir: fantastik bir yaratık, bir hayvan, özgün bir karakter, sevdiğin bir dünyanın öğesi ya da senin için anlamı olan bir nesne. Sabit temalar yok; yaratıcılığını özgürce kullan.

Nasıl işleyecek?

1. Fikrini paylaş. Bu e-postayı yanıtlayıp rozetinde neler görmek istediğini anlat. Aklındaki tasarımı, karakteri, temayı veya renkleri tarif edebilirsin.

2. Rozetini tasarlayalım. Ekibimiz fikrinden ilham alarak sana özel bir tasarım hazırlayacak.

3. Yayına girmeden önce incele. Rozeti profiline eklemeden önce tamamlanmış hâlini bir kez incelemen için sana göndereceğiz. Son düzenleme isteklerini bu aşamada iletebilirsin.

Storigam tarihinde sana ayrılan bir yer

Rozetin uygulamadaki profilinde görüntülenecek ve yolculuğumuza en başından katılanları kutladığımız Storigam web sitesindeki Onur Listesi’nde de yer alacak.

Bu rozetler yalnızca Beta Kullanıcılarına ve Kuruculara özeldir. Storigam’ı bugünkü hâline getirmemize yardımcı olanları takdir etmenin küçük bir yoludur.

Hazır olduğunda, rozet fikrini bu e-postayı yanıtlayarak göndermen yeterli. Senin için özel bir şey tasarlamayı dört gözle bekliyoruz.

Storigam’ın bir parçası olduğun için teşekkür ederiz.

Sevgiler,
Team Storigam
Oyuncuların hikâyeleri.

Soruların mı var? Bize support@storigam.com adresinden ulaşabilirsin.

Bu e-postayı Storigam beta güncellemelerini istediğin için aldın. Gelecekteki güncellemeleri durdurmak için buradan abonelikten çık: {{unsubscribeUrl}}`,
  },
  fr: {
    subject: "Votre badge bêta Storigam — partagez votre idée",
    text: `Bonjour,

En tant que membre bêta de Storigam, vous faites partie de notre aventure depuis ses débuts. Nous aimerions rendre ce moment encore plus mémorable avec une création conçue spécialement pour vous.

Nous créons des badges exclusifs, réservés aux membres bêta et aux fondateurs de Storigam. Chacun sera unique et viendra enrichir votre profil, en s’inspirant de votre personnalité, de vos centres d’intérêt et de votre imagination.

Votre idée, votre badge

Votre badge peut s’inspirer de tout ce qui vous plaît : une créature fantastique, un animal, un personnage original, un univers que vous aimez ou même un objet qui compte pour vous. Aucun thème n’est imposé, alors laissez libre cours à votre créativité.

Comment ça marche

1. Partagez votre idée. Répondez à cet e-mail pour nous dire ce que vous aimeriez voir sur votre badge. Vous pouvez décrire le design, le personnage, le thème ou les couleurs que vous imaginez.

2. Nous créons votre badge. Notre équipe s’inspirera de votre idée pour concevoir une création unique.

3. Vous le validez avant sa mise en ligne. Nous vous enverrons le badge terminé pour une relecture avant de l’ajouter à votre profil. Vous pourrez alors demander les derniers ajustements.

Une place dans l’histoire de Storigam

Votre badge apparaîtra sur votre profil dans l’application et dans le Hall of Fame du site Storigam, qui met à l’honneur les personnes présentes depuis le début de notre aventure.

Ces badges sont réservés aux membres bêta et aux fondateurs. C’est une petite façon de remercier celles et ceux qui ont contribué à faire de Storigam ce qu’il est aujourd’hui.

Quand vous le souhaitez, répondez simplement à cet e-mail avec votre idée de badge. Nous avons hâte de créer quelque chose de spécial pour vous.

Merci de faire partie de Storigam.

Bien chaleureusement,
L’équipe Storigam
Des histoires créées par des gamers.

Une question ? Écrivez-nous à support@storigam.com.

Vous recevez cet e-mail car vous avez demandé des nouvelles de la bêta Storigam. Pour ne plus recevoir les prochaines actualités, désabonnez-vous ici : {{unsubscribeUrl}}`,
  },
  de: {
    subject: "Dein Storigam-Beta-Abzeichen — teile deine Idee",
    text: `Hallo,

Als Beta-Nutzerin oder Beta-Nutzer von Storigam bist du von Anfang an Teil unserer Reise. Mit etwas, das speziell für dich entsteht, möchten wir diesen Moment noch unvergesslicher machen.

Wir entwerfen exklusive Abzeichen, die nur Beta-Nutzern und Gründern von Storigam vorbehalten sind. Jedes Abzeichen wird dein Profil auf einzigartige Weise ergänzen und von deiner Persönlichkeit, deinen Interessen und deiner Fantasie inspiriert sein.

Deine Idee, dein Abzeichen

Dein Abzeichen kann von allem inspiriert sein, was dir gefällt: einem Fantasiewesen, einem Tier, einer eigenen Figur, einer Welt, die du liebst, oder einem Gegenstand, der dir etwas bedeutet. Es gibt keine festen Themen – sei einfach kreativ.

So funktioniert es

1. Teile deine Idee. Antworte auf diese E-Mail und erzähle uns, was auf deinem Abzeichen zu sehen sein soll. Du kannst das Design, die Figur, das Thema oder die Farben beschreiben, die du dir vorstellst.

2. Wir gestalten dein Abzeichen. Unser Team nutzt deine Idee als Inspiration und entwirft etwas Einzigartiges für dich.

3. Prüfe es, bevor es veröffentlicht wird. Bevor wir das fertige Abzeichen deinem Profil hinzufügen, schicken wir es dir einmal zur Ansicht. Dabei kannst du noch letzte Anpassungen wünschen.

Ein Platz in der Geschichte von Storigam

Dein Abzeichen erscheint in deinem App-Profil und in der Hall of Fame auf der Storigam-Website. Dort feiern wir alle, die von Anfang an Teil unserer Reise waren.

Diese Abzeichen sind Beta-Nutzern und Gründern vorbehalten. Damit möchten wir den Menschen danken, die Storigam zu dem gemacht haben, was es heute ist.

Wenn du bereit bist, antworte einfach auf diese E-Mail und sende uns deine Abzeichen-Idee. Wir freuen uns darauf, etwas Besonderes für dich zu gestalten.

Danke, dass du Teil von Storigam bist.

Herzliche Grüße
Team Storigam
Geschichten von Gamern.

Fragen? Schreib uns an support@storigam.com.

Du erhältst diese E-Mail, weil du Neuigkeiten zur Storigam-Beta angefordert hast. Hier kannst du dich von zukünftigen Updates abmelden: {{unsubscribeUrl}}`,
  },
  pt: {
    subject: "Seu emblema beta do Storigam — compartilhe sua ideia",
    text: `Olá,

Como participante beta do Storigam, você faz parte da nossa jornada desde o começo. Queremos tornar esse momento ainda mais especial com algo criado especialmente para você.

Estamos criando emblemas exclusivos, reservados apenas aos participantes beta e fundadores do Storigam. Cada emblema será uma adição única ao seu perfil, inspirada na sua personalidade, nos seus interesses e na sua imaginação.

Sua ideia, seu emblema

Seu emblema pode se inspirar em qualquer coisa de que você goste: uma criatura fantástica, um animal, um personagem original, um universo que você ama ou até um objeto importante para você. Não há temas definidos, então use a criatividade.

Como funciona

1. Compartilhe sua ideia. Responda a este e-mail e conte o que gostaria de ver no seu emblema. Você pode descrever o design, o personagem, o tema ou as cores que tem em mente.

2. Criamos seu emblema. Nossa equipe usará sua ideia como inspiração para criar algo único para você.

3. Revise antes de ficar disponível. Enviaremos o emblema finalizado para uma revisão antes de adicioná-lo ao seu perfil. Assim, você poderá pedir os últimos ajustes.

Um lugar na história do Storigam

Seu emblema será exibido no seu perfil no aplicativo e também no Hall da Fama do site do Storigam, celebrando quem faz parte da nossa jornada desde o início.

Esses emblemas são exclusivos para participantes beta e fundadores. É uma pequena forma de reconhecer quem ajudou a fazer do Storigam o que ele é hoje.

Quando quiser, basta responder a este e-mail com sua ideia. Estamos ansiosos para criar algo especial para você.

Obrigado por fazer parte do Storigam.

Com carinho,
Equipe Storigam
Histórias feitas por gamers.

Dúvidas? Fale conosco pelo e-mail support@storigam.com.

Você recebeu este e-mail porque pediu novidades sobre o beta do Storigam. Para deixar de receber futuras atualizações, cancele a inscrição aqui: {{unsubscribeUrl}}`,
  },
  ko: {
    subject: "Storigam 베타 전용 배지 — 아이디어를 들려주세요",
    text: `안녕하세요.

Storigam 베타 사용자로서 여러분은 처음부터 우리의 여정에 함께해 주셨어요. 여러분만을 위해 만든 특별한 선물로 그 시작을 더 오래 기억하고 싶습니다.

Storigam 베타 사용자와 창립자만을 위한 전용 배지를 만들고 있어요. 각 배지는 여러분의 성격, 관심사, 상상력에서 영감을 받아 프로필에 특별함을 더해 줄 거예요.

여러분의 아이디어, 여러분의 배지

배지의 영감은 무엇이든 좋아요. 판타지 생물, 동물, 오리지널 캐릭터, 사랑하는 세계관, 또는 여러분에게 의미 있는 물건도 괜찮습니다. 정해진 주제는 없으니 자유롭게 상상해 주세요.

진행 방법

1. 아이디어를 들려주세요. 이 이메일에 답장해 배지에 담고 싶은 내용을 알려 주세요. 생각해 둔 디자인, 캐릭터, 테마, 색상을 설명해 주시면 됩니다.

2. 배지를 제작합니다. 팀이 여러분의 아이디어를 바탕으로 세상에 하나뿐인 디자인을 만들게요.

3. 공개 전에 확인해 주세요. 프로필에 추가하기 전에 완성된 배지를 한 번 보내 드립니다. 그때 마지막으로 수정하고 싶은 점을 요청할 수 있어요.

Storigam의 역사에 남을 자리

배지는 앱 프로필에 표시되며, 처음부터 우리의 여정에 함께한 분들을 기념하는 Storigam 웹사이트 명예의 전당에도 소개됩니다.

이 배지는 베타 사용자와 창립자만을 위한 특별한 혜택입니다. Storigam을 지금의 모습으로 만드는 데 함께해 주신 분들께 전하는 작은 감사의 표시예요.

준비되면 이 이메일에 답장으로 배지 아이디어를 보내 주세요. 여러분만을 위한 특별한 디자인을 만들 날을 기다릴게요.

Storigam의 일부가 되어 주셔서 감사합니다.

따뜻한 마음을 담아,
Team Storigam
게이머가 만드는 이야기.

궁금한 점은 support@storigam.com 으로 문의해 주세요.

Storigam 베타 소식을 요청하셔서 이 이메일을 받으셨습니다. 앞으로 소식을 받지 않으려면 여기에서 수신을 취소해 주세요: {{unsubscribeUrl}}`,
  },
  zh: {
    subject: "你的 Storigam 测试版专属徽章——分享你的创意",
    text: `你好！

作为 Storigam 测试用户，你从一开始就参与了我们的旅程。我们想为你特别创作一份礼物，让这段经历更加难忘。

我们正在设计仅面向 Storigam 测试用户和创始成员的专属徽章。每枚徽章都会成为你个人资料中的独特装饰，并从你的个性、兴趣和想象力中汲取灵感。

你的创意，你的徽章

徽章可以从任何你喜欢的事物中获得灵感：奇幻生物、动物、原创角色、你喜爱的世界，或对你有意义的物品。没有固定主题，尽情发挥创意吧。

流程说明

1. 分享你的想法。直接回复这封邮件，告诉我们你希望徽章呈现什么。你可以描述设计、角色、主题或心中的颜色。

2. 我们为你创作徽章。团队会以你的想法为灵感，为你设计独一无二的徽章。

3. 上线前由你确认。在把徽章添加到个人资料之前，我们会先把完成稿发给你审核一次，你可以在这时提出最后的调整要求。

在 Storigam 的历程中留下专属位置

你的徽章会展示在应用个人资料中，也会登上 Storigam 网站的名人堂，纪念从一开始就加入我们旅程的成员。

这些徽章仅属于测试用户和创始成员。这是我们对帮助 Storigam 成长至今的每个人表达感谢的一种小小方式。

准备好后，直接回复这封邮件并发送你的徽章创意。我们期待为你创作特别的作品。

感谢你成为 Storigam 的一员。

诚挚问候，
Storigam 团队
由玩家创造的故事。

有问题吗？请通过 support@storigam.com 联系我们。

你收到此邮件是因为你申请了 Storigam 测试版消息。如不想再收到后续更新，请在此取消订阅：{{unsubscribeUrl}}`,
  },
  ru: {
    subject: "Твой эксклюзивный бета-бейдж Storigam — поделись идеей",
    text: `Здравствуйте!

Как бета-участник Storigam, вы с нами с самого начала. Мы хотим сделать этот момент ещё памятнее и создать кое-что специально для вас.

Мы создаём эксклюзивные бейджи только для бета-участников и основателей Storigam. Каждый бейдж станет уникальным дополнением профиля и будет вдохновлён вашей индивидуальностью, интересами и воображением.

Ваша идея — ваш бейдж

Идеей для бейджа может стать что угодно: фантастическое существо, животное, оригинальный персонаж, любимый мир или даже важный для вас предмет. Темы не ограничены — дайте волю воображению.

Как это будет работать

1. Поделитесь идеей. Ответьте на это письмо и расскажите, что вы хотели бы видеть на бейдже. Опишите дизайн, персонажа, тему или цвета, которые вы представляете.

2. Мы создадим бейдж. Наша команда вдохновится вашей идеей и разработает уникальный дизайн специально для вас.

3. Вы проверите его до публикации. Перед добавлением бейджа в профиль мы один раз отправим вам готовый вариант на проверку. Вы сможете попросить внести последние изменения.

Ваше место в истории Storigam

Бейдж появится в профиле приложения и на странице «Зал славы» сайта Storigam, где мы отмечаем тех, кто был с нами с самого начала.

Эти бейджи доступны только бета-участникам и основателям. Так мы хотим поблагодарить людей, которые помогли Storigam стать таким, каким он является сегодня.

Когда будете готовы, просто ответьте на это письмо и отправьте идею бейджа. Мы с нетерпением ждём возможности создать для вас что-то особенное.

Спасибо, что вы с Storigam.

С теплом,
Команда Storigam
Истории, созданные игроками.

Есть вопросы? Напишите нам: support@storigam.com.

Вы получили это письмо, потому что запросили новости о бета-версии Storigam. Чтобы не получать дальнейшие обновления, отмените подписку здесь: {{unsubscribeUrl}}`,
  },
  ar: {
    subject: "شارة Storigam التجريبية الخاصة بك — شاركنا فكرتك",
    text: `مرحبًا،

بصفتك من مستخدمي Storigam التجريبيين، فأنت جزء من رحلتنا منذ بدايتها. نريد أن نجعل هذه البداية أكثر تميزًا بشيء صُمم خصيصًا لك.

نعمل على تصميم شارات حصرية لمستخدمي Storigam التجريبيين والمؤسسين فقط. ستكون كل شارة إضافة فريدة إلى ملفك الشخصي، مستوحاة من شخصيتك واهتماماتك وخيالك.

فكرتك، شارتك

يمكن أن تستلهم شارتك من أي شيء تحبه: مخلوق خيالي، أو حيوان، أو شخصية من ابتكارك، أو عالم تحبه، أو حتى غرض له معنى خاص بالنسبة إليك. لا توجد مواضيع محددة، لذا أطلق العنان لإبداعك.

كيف تسير العملية؟

1. شارك فكرتك. أجب عن هذا البريد وأخبرنا بما ترغب في أن تتضمنه شارتك. يمكنك وصف التصميم أو الشخصية أو الفكرة أو الألوان التي تتخيلها.

2. نصمم شارتك. سيستلهم فريقنا من فكرتك ليصمم لك شيئًا فريدًا.

3. راجعها قبل نشرها. سنرسل إليك الشارة بعد اكتمالها لمراجعتها مرة واحدة قبل إضافتها إلى ملفك الشخصي، لتتمكن من طلب التعديلات الأخيرة.

مكان لك في تاريخ Storigam

ستظهر شارتك في ملفك الشخصي داخل التطبيق، وستُعرض أيضًا في «قاعة المشاهير» على موقع Storigam للاحتفاء بمن كانوا جزءًا من رحلتنا منذ البداية.

هذه الشارات حصرية للمستخدمين التجريبيين والمؤسسين. وهي طريقتنا البسيطة لتقدير من ساعدوا في جعل Storigam على ما هو عليه اليوم.

عندما تكون مستعدًا، أجب عن هذا البريد وأرسل فكرتك للشارة. نتطلع إلى ابتكار شيء مميز لك.

شكرًا لكونك جزءًا من Storigam.

مع أطيب التحيات،
فريق Storigam
قصص يصنعها اللاعبون.

هل لديك سؤال؟ تواصل معنا عبر support@storigam.com.

وصلتك هذه الرسالة لأنك طلبت تحديثات النسخة التجريبية من Storigam. لإيقاف التحديثات المستقبلية، ألغِ الاشتراك من هنا: {{unsubscribeUrl}}`,
  },
  it: {
    subject: "Il tuo badge beta esclusivo di Storigam — condividi la tua idea",
    text: `Ciao,

Come utente beta di Storigam, fai parte del nostro percorso fin dall’inizio. Vogliamo rendere questo momento ancora più speciale con qualcosa creato apposta per te.

Stiamo progettando badge esclusivi, riservati solo agli utenti beta e ai founder di Storigam. Ogni badge sarà un’aggiunta unica al tuo profilo, ispirata alla tua personalità, ai tuoi interessi e alla tua fantasia.

La tua idea, il tuo badge

Il tuo badge può ispirarsi a qualsiasi cosa ti piaccia: una creatura fantastica, un animale, un personaggio originale, un mondo che ami o persino un oggetto importante per te. Non ci sono temi fissi: libera la tua creatività.

Come funziona

1. Condividi la tua idea. Rispondi a questa email e raccontaci cosa vorresti vedere sul tuo badge. Puoi descrivere il design, il personaggio, il tema o i colori che hai in mente.

2. Creiamo il tuo badge. Il nostro team userà la tua idea come ispirazione per realizzare qualcosa di unico per te.

3. Rivedilo prima che venga pubblicato. Ti invieremo il badge finito per una revisione prima di aggiungerlo al tuo profilo. Potrai chiedere le ultime modifiche.

Un posto nella storia di Storigam

Il tuo badge sarà visibile sul tuo profilo nell’app e sarà inserito anche nella Hall of Fame del sito Storigam, dedicata a chi ha fatto parte del nostro percorso fin dall’inizio.

Questi badge sono riservati agli utenti beta e ai founder. Sono un piccolo modo per riconoscere chi ha contribuito a rendere Storigam ciò che è oggi.

Quando vuoi, rispondi semplicemente a questa email con la tua idea. Non vediamo l’ora di creare qualcosa di speciale per te.

Grazie per far parte di Storigam.

Un caro saluto,
Team Storigam
Storie create dai gamer.

Domande? Scrivici a support@storigam.com.

Hai ricevuto questa email perché hai richiesto aggiornamenti sulla beta di Storigam. Per non ricevere altri aggiornamenti, annulla l’iscrizione qui: {{unsubscribeUrl}}`,
  },
};

export function buildStorigamBetaBadgeEmail(language: unknown, unsubscribeUrl: string) {
  const template = templates[normalizeStorigamInterestLanguage(language)];
  return {
    subject: template.subject,
    text: template.text.replace("{{unsubscribeUrl}}", unsubscribeUrl),
  };
}

import { READ_LEARN_ARTICLES } from '../constants';
import type { ReadLearnArticle } from '../types';

export type LearnCategory = 'space' | 'nature' | 'earth' | 'animals' | 'body' | 'science' | 'habits';

export const LEARN_CATEGORIES: { id: LearnCategory; ar: string; en: string }[] = [
  { id: 'space', ar: 'الفضاء', en: 'Space' },
  { id: 'nature', ar: 'الطبيعة', en: 'Nature' },
  { id: 'earth', ar: 'كوكبنا', en: 'Our planet' },
  { id: 'animals', ar: 'الحيوانات', en: 'Animals' },
  { id: 'body', ar: 'جسمي', en: 'My body' },
  { id: 'science', ar: 'علوم وتقنية', en: 'Science & tech' },
  { id: 'habits', ar: 'عادات جميلة', en: 'Good habits' },
];

export interface LearnCard extends ReadLearnArticle {
  cat: LearnCategory;
}

// [المعرّف، التصنيف، العنوان عربي، العنوان إنجليزي، الشرح عربي، الشرح إنجليزي]
type Row = [string, LearnCategory, string, string, string, string];

const ROWS: Row[] = [
  ['why-moon-changes', 'space', 'لماذا يتغيّر شكل القمر؟', 'Why does the Moon change shape?',
    'القمر لا يضيء بنفسه، بل يعكس ضوء الشمس. وهو يدور حول الأرض، فنرى منه كل ليلة جزءاً مضاءً مختلفاً، فيبدو هلالاً ثم نصفاً ثم بدراً كاملاً. وتستغرق الدورة الكاملة نحو تسعة وعشرين يوماً.',
    'The Moon makes no light of its own; it reflects sunlight. As it circles the Earth we see a different lit part each night, so it looks like a crescent, then a half, then a full circle. One full cycle takes about 29 days.'],
  ['why-day-night', 'space', 'كيف يتعاقب الليل والنهار؟', 'How do day and night happen?',
    'الأرض تدور حول نفسها دورة كاملة كل أربع وعشرين ساعة. الجهة التي تواجه الشمس يكون فيها نهار، والجهة المعاكسة يكون فيها ليل. ولهذا تشرق الشمس عندنا بينما أصدقاؤنا في الجهة الأخرى نائمون.',
    'The Earth spins once every 24 hours. The side facing the Sun has day and the opposite side has night. That is why it is sunny here while friends on the other side of the world are asleep.'],
  ['why-seasons', 'space', 'لماذا تتغيّر الفصول؟', 'Why do we have seasons?',
    'محور الأرض مائل قليلاً. وأثناء دورانها حول الشمس خلال سنة كاملة، تميل نصفها تارة نحو الشمس فيصير صيفاً دافئاً، وتبتعد تارة فيصير شتاءً بارداً. وبين الفصلين يأتي الربيع والخريف.',
    'The Earth is tilted a little. As it circles the Sun during a year, one half leans toward the Sun and has warm summer, then leans away and has cold winter. Spring and autumn come in between.'],
  ['sun-is-star', 'space', 'هل الشمس نجمة؟', 'Is the Sun a star?',
    'نعم! الشمس نجمة متوسطة الحجم، وهي كرة ضخمة من الغاز الملتهب. تبدو أكبر من بقية النجوم لأنها الأقرب إلينا، ويحتاج ضوءها نحو ثماني دقائق ليصل إلى الأرض.',
    'Yes! The Sun is a medium-sized star, a giant ball of burning gas. It looks bigger than other stars because it is the closest one, and its light needs about eight minutes to reach Earth.'],
  ['why-stars-twinkle', 'space', 'لماذا تتلألأ النجوم؟', 'Why do stars twinkle?',
    'ضوء النجوم يسافر في الفضاء هادئاً، ثم يمرّ في هواء الأرض المتحرك قبل أن يصل إلى عينيك. الهواء يثني الضوء قليلاً وبسرعة، فيبدو النجم وكأنه يرمش ويتلألأ.',
    'Starlight travels calmly through space, then passes through the moving air of the Earth before reaching your eyes. The air bends the light a little, again and again, so the star seems to blink and sparkle.'],
  ['eight-planets', 'space', 'ما كواكب المجموعة الشمسية؟', 'What are the planets of the Solar System?',
    'ثمانية كواكب تدور حول الشمس: عطارد والزهرة والأرض والمريخ والمشتري وزحل وأورانوس ونبتون. والأرض هي الكوكب الوحيد الذي نعرف أن عليه حياة، فلنحافظ عليه.',
    'Eight planets circle the Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Earth is the only planet we know that has life on it, so let us take good care of it.'],
  ['what-is-gravity', 'space', 'ما الجاذبية؟', 'What is gravity?',
    'الجاذبية قوة غير مرئية تشدّ الأشياء نحو بعضها. والأرض كبيرة جداً فتشدّنا إلى الأرض، ولهذا لا نطير في الهواء وإذا رميت كرة تعود إلى الأسفل. والقمر نفسه تمسكه جاذبية الأرض فيدور حولها.',
    'Gravity is an invisible force that pulls things toward each other. The Earth is so big that it pulls us down, which is why we do not float away and a thrown ball comes back. Earth\'s gravity even holds the Moon in its orbit.'],

  ['how-rain-forms', 'nature', 'كيف تتكوّن الأمطار؟', 'How does rain form?',
    'الشمس تسخّن البحار فيتبخّر بعض الماء ويصعد إلى السماء. هناك يبرد ويتجمّع في قطرات صغيرة تكوّن الغيوم. وعندما تصير القطرات ثقيلة تسقط علينا مطراً، ثم يعود الماء إلى البحر ويبدأ كل شيء من جديد.',
    'The Sun warms the seas and some water rises into the sky as vapor. Up high it cools and gathers into tiny droplets that make clouds. When the drops get heavy they fall as rain, flow back to the sea, and the journey starts again.'],
  ['how-rainbow-appears', 'nature', 'كيف يظهر قوس قزح؟', 'How does a rainbow appear?',
    'عندما تدخل أشعة الشمس قطرات المطر العالقة في الهواء، ينكسر الضوء وتنفصل ألوانه السبعة. نراه حين تكون الشمس خلف ظهورنا والمطر أمامنا. ابحث عن الأحمر في أعلاه والبنفسجي في أسفله.',
    'When sunlight enters raindrops floating in the air, the light bends and splits into its seven colors. We see it when the Sun is behind us and the rain is in front of us. Look for red on the outside and violet on the inside.'],
  ['why-sea-salty', 'nature', 'لماذا ماء البحر مالح؟', 'Why is seawater salty?',
    'منذ ملايين السنين والأمطار والأنهار تجرف أملاحاً صغيرة من الصخور إلى البحر. وعندما يتبخّر ماء البحر تحت الشمس يبقى الملح فيه، فتزداد ملوحته على مرّ الزمن.',
    'For millions of years rain and rivers have washed tiny salts from rocks into the sea. When seawater evaporates in the Sun, the salt stays behind, so the sea slowly becomes saltier.'],
  ['how-seed-grows', 'nature', 'كيف تنمو البذرة؟', 'How does a seed grow?',
    'البذرة تحتاج إلى ماء ودفء وتربة. فتنتفخ ثم يخرج منها جذر صغير يتجه إلى الأسفل، وساق رفيعة تصعد نحو الضوء. ومع الأيام تتفتح الأوراق وتصبح البذرة نبتة صغيرة ثم شجرة كبيرة.',
    'A seed needs water, warmth and soil. It swells, a small root grows down, and a thin stem climbs toward the light. Day by day leaves open and the seed becomes a little plant, and later a big tree.'],
  ['why-leaves-fall', 'nature', 'لماذا تتساقط أوراق الشجر في الخريف؟', 'Why do leaves fall in autumn?',
    'عندما يقصر النهار ويبرد الجو تستعد بعض الأشجار للشتاء. توقف الشجرة صنع الأخضر في أوراقها لتوفّر الماء، فتظهر ألوان الأصفر والبرتقالي والأحمر ثم تسقط الأوراق وتنام الشجرة حتى الربيع.',
    'When days get shorter and cooler, some trees get ready for winter. The tree stops making green in its leaves to save water, so yellow, orange and red appear, then the leaves fall and the tree rests until spring.'],
  ['how-bees-make-honey', 'nature', 'كيف يصنع النحل العسل؟', 'How do bees make honey?',
    'تجمع النحلة رحيق الأزهار الحلو وتحمله في معدتها الصغيرة إلى الخلية. هناك تنقله النحلات إلى بعضها وترفرف بأجنحتها ليتبخر ماؤه، فيصير غليظاً حلواً هو العسل. تحتاج النحلة طوال عمرها إلى جمع ملعقة صغيرة فقط!',
    'A bee collects sweet nectar from flowers and carries it in her little honey stomach to the hive. There the bees pass it along and fan it with their wings until the water dries up, leaving thick sweet honey. One bee makes only about a teaspoon in her whole life!'],
  ['why-trees-matter', 'nature', 'لماذا الأشجار مهمة؟', 'Why are trees important?',
    'الأشجار تصنع الأكسجين الذي نتنفسه، وتعطينا الظل والثمار، وتثبّت التربة بجذورها حتى لا تجرفها الأمطار، وهي بيوت للطيور والحشرات. غرس شجرة هدية جميلة للأرض.',
    'Trees make the oxygen we breathe, give us shade and fruit, hold the soil with their roots so rain cannot wash it away, and are homes for birds and insects. Planting a tree is a lovely gift to the Earth.'],

  ['why-earthquakes', 'earth', 'لماذا تحدث الزلازل؟', 'Why do earthquakes happen?',
    'قشرة الأرض مكوّنة من قطع ضخمة تتحرك ببطء شديد. وأحياناً تحتكّ هذه القطع أو تنزلق فجأة فتهتزّ الأرض فوقها. إذا شعرت بزلزال فاحمِ رأسك واحتمِ تحت طاولة قوية.',
    'The Earth\'s crust is made of huge pieces that move very slowly. Sometimes they rub or slip suddenly and the ground above shakes. If you feel an earthquake, protect your head and take cover under a sturdy table.'],
  ['how-waves-form', 'earth', 'كيف تتكوّن أمواج البحر؟', 'How do ocean waves form?',
    'الرياح تمرّ فوق سطح الماء فتدفعه فيرتفع وينخفض. كلما كانت الرياح أقوى وأطول مدة كبرت الأمواج. وعندما تقترب الموجة من الشاطئ تتباطأ وتنكسر على الرمل.',
    'Wind blowing across the water pushes it up and down. The stronger and longer the wind blows, the bigger the waves grow. When a wave nears the shore it slows down and breaks on the sand.'],
  ['what-is-desert', 'earth', 'لماذا الصحراء جافة؟', 'Why is the desert so dry?',
    'الصحراء مكان يسقط فيه مطر قليل جداً في السنة. والنباتات والحيوانات هناك تعلمت العيش بقليل من الماء: الصبّار يخزّن الماء في ساقه، والجمل يتحمّل العطش أياماً.',
    'A desert is a place that gets very little rain all year. Plants and animals there have learned to live with little water: a cactus stores water in its stem and a camel can go days without a drink.'],

  ['how-birds-fly', 'animals', 'كيف تطير الطيور؟', 'How do birds fly?',
    'للطيور أجنحة منحنية قليلاً وعظام خفيفة مجوّفة وعضلات صدر قوية. عندما ترفرف تدفع الهواء إلى الأسفل والخلف، فيرفعها الهواء إلى الأعلى ويدفعها إلى الأمام.',
    'Birds have slightly curved wings, light hollow bones and strong chest muscles. When they flap, they push air down and back, and the air lifts them up and pushes them forward.'],
  ['how-fish-breathe', 'animals', 'كيف تتنفس الأسماك تحت الماء؟', 'How do fish breathe underwater?',
    'في الماء هواء ذائب لا نراه. والسمكة تبتلع الماء وتمرّره على الخياشيم، وهي أعضاء رقيقة جداً تمتصّ الأكسجين منه ثم يخرج الماء من جانبي الرأس.',
    'Water holds dissolved air that we cannot see. A fish takes in water and passes it over its gills, thin organs that soak up the oxygen, and then the water flows out at the sides of its head.'],
  ['whats-in-camel-hump', 'animals', 'ماذا يوجد في سنام الجمل؟', 'What is inside a camel\'s hump?',
    'السنام مخزن من الدهون وليس من الماء. عندما لا يجد الجمل طعاماً يستعمل هذه الدهون ليحصل على الطاقة. وعندما يجد الماء يشرب كمية كبيرة بسرعة، فيقدر على السير في الصحراء أياماً.',
    'The hump is a store of fat, not water. When food is scarce the camel uses this fat for energy. When it finds water it can drink a great amount very fast, so it can walk through the desert for days.'],
  ['why-cats-purr', 'animals', 'لماذا تخرخر القطط؟', 'Why do cats purr?',
    'تصدر القطة الخرخرة باهتزاز عضلات صغيرة في حنجرتها. تخرخر غالباً عندما تكون مرتاحة وسعيدة، وأحياناً لتهدّئ نفسها إذا كانت متعبة أو خائفة. وهي طريقة لطيفة لتقول إنها تحبك.',
    'A cat purrs by vibrating tiny muscles in her throat. She often purrs when she is relaxed and happy, and sometimes to calm herself when she is tired or scared. It is a gentle way to say she likes you.'],
  ['caterpillar-to-butterfly', 'animals', 'كيف تصبح اليرقة فراشة؟', 'How does a caterpillar become a butterfly?',
    'تخرج اليرقة من بيضة صغيرة وتأكل أوراقاً كثيرة فتكبر. ثم تصنع شرنقة وتبقى داخلها أياماً يتغيّر فيها جسمها كله. وعندما تخرج تكون فراشة بأجنحة ملوّنة تطير بها إلى الأزهار.',
    'A caterpillar hatches from a tiny egg and eats lots of leaves to grow. Then it makes a chrysalis and stays inside for days while its whole body changes. When it comes out it is a butterfly with colorful wings, ready to visit flowers.'],
  ['why-owls-night', 'animals', 'لماذا تسهر البومة ليلاً؟', 'Why are owls awake at night?',
    'للبومة عيون كبيرة ترى جيداً في الظلام، وأذنان دقيقتان تسمعان أصغر حفيف، وريش ناعم يجعل طيرانها بلا صوت. لذلك تصطاد ليلاً وتنام في النهار.',
    'An owl has big eyes that see well in the dark, sharp ears that hear the tiniest rustle, and soft feathers that make her flight silent. That is why she hunts at night and sleeps by day.'],
  ['is-whale-a-fish', 'animals', 'هل الحوت سمكة؟', 'Is a whale a fish?',
    'لا، الحوت من الثدييات مثلنا. يتنفس الهواء بالرئتين من فتحة فوق رأسه، فيصعد إلى سطح الماء ليأخذ نفساً. وتلد الحوتة صغيرها وترضعه حليباً.',
    'No, a whale is a mammal like us. It breathes air with lungs through a blowhole on top of its head, so it rises to the surface for a breath. A mother whale gives birth and feeds her baby milk.'],

  ['why-heart-beats', 'body', 'لماذا يخفق القلب؟', 'Why does the heart beat?',
    'القلب عضلة قوية بحجم قبضة يدك، تضخّ الدم إلى الجسم كله ليصل الغذاء والأكسجين إلى كل مكان. تسمع نبضه عندما تضع يدك على صدرك، ويسرع عندما تركض أو تلعب.',
    'The heart is a strong muscle about the size of your fist. It pumps blood around the whole body to carry food and oxygen everywhere. You can feel it when you put a hand on your chest, and it beats faster when you run or play.'],
  ['why-hiccups', 'body', 'لماذا نُصاب بالفواق؟', 'Why do we get hiccups?',
    'تحت رئتيك عضلة تُسمّى الحجاب الحاجز. أحياناً تنقبض فجأة فتنغلق الأحبال الصوتية بسرعة فيصدر صوت "هِك". يساعدك على التخلص منه أن تحبس نفسك قليلاً أو تشرب الماء ببطء.',
    'Under your lungs is a muscle called the diaphragm. Sometimes it jumps suddenly and your vocal cords snap shut, making a "hic" sound. Holding your breath for a moment or sipping water slowly can help.'],
  ['why-we-sneeze', 'body', 'لماذا نعطس؟', 'Why do we sneeze?',
    'العطس طريقة ذكية يطرد بها أنفك الغبار والجراثيم التي دخلت إليه، فيدفعها بهواء سريع جداً. تذكّر أن تضع كوعك أمام أنفك وفمك عندما تعطس حتى تحمي من حولك.',
    'A sneeze is your nose\'s clever way of blowing out dust and germs that sneaked in, using very fast air. Remember to sneeze into your elbow so you protect the people around you.'],
  ['why-we-sleep', 'body', 'لماذا ننام؟', 'Why do we sleep?',
    'عندما ننام يرتاح الجسم ويصلح نفسه، ويرتّب الدماغ ما تعلّمناه في النهار، وينمو الأطفال أكثر. ويحتاج الأطفال إلى نحو تسع إلى إحدى عشرة ساعة نوم كل ليلة.',
    'While we sleep the body rests and repairs itself, the brain sorts out what we learned during the day, and children grow more. Kids need about nine to eleven hours of sleep every night.'],
  ['why-baby-teeth-fall', 'body', 'لماذا تسقط أسنان الأطفال؟', 'Why do baby teeth fall out?',
    'الأسنان اللبنية صغيرة لأن فمك صغير. وعندما يكبر فمك تنمو تحتها أسنان دائمة أكبر وأقوى، فتدفع القديمة لتسقط. اغسل أسنانك مرتين كل يوم لتبقى الدائمة سليمة طوال العمر.',
    'Baby teeth are small because your mouth is small. As your mouth grows, bigger, stronger adult teeth push up beneath them and the old ones fall out. Brush twice every day so your grown-up teeth last a lifetime.'],
  ['why-wash-hands', 'body', 'لماذا نغسل أيدينا؟', 'Why do we wash our hands?',
    'على أيدينا جراثيم صغيرة جداً لا نراها بالعين. الماء والصابون يفككانها ويجرفانها بعيداً. اغسل يديك قبل الأكل وبعد اللعب وبعد الحمام، وافركهما بالصابون مدة غناء أغنية قصيرة.',
    'Our hands carry tiny germs we cannot see. Soap and water break them apart and wash them away. Wash before eating, after playing and after the bathroom, scrubbing for as long as a short song.'],
  ['five-senses', 'body', 'ما حواسّنا الخمس؟', 'What are our five senses?',
    'البصر بالعيون، والسمع بالأذنين، والشم بالأنف، والتذوق باللسان، واللمس بالجلد. تنقل الحواس ما حولنا إلى الدماغ ليفهمه، وتساعدنا على الاستمتاع بالحياة وعلى حماية أنفسنا.',
    'Sight with the eyes, hearing with the ears, smell with the nose, taste with the tongue and touch with the skin. The senses send the world around us to the brain so it can understand, helping us enjoy life and stay safe.'],

  ['why-ice-floats', 'science', 'لماذا يطفو الجليد على الماء؟', 'Why does ice float on water?',
    'عندما يتجمّد الماء تتباعد جزيئاته قليلاً فيصير الجليد أخفّ من الماء السائل. لذلك يطفو، وهذا يحمي الأسماك تحت بحيرة متجمّدة فتبقى دافئة في الماء السائل أسفله.',
    'When water freezes its tiny parts spread a little apart, so ice is lighter than liquid water. That is why it floats, and it keeps the fish in a frozen lake safe in the liquid water below.'],
  ['what-is-electricity', 'science', 'ما الكهرباء؟', 'What is electricity?',
    'الكهرباء جسيمات صغيرة جداً تجري داخل الأسلاك فتُضيء المصابيح وتشغّل الأجهزة. وهي مفيدة لكنها خطرة أيضاً، لذلك لا تلمس المقابس أو الأسلاك العارية أبداً وأخبر الكبار عند رؤيتها.',
    'Electricity is made of tiny particles running through wires that light bulbs and power machines. It is useful but also dangerous, so never touch plugs or bare wires and tell a grown-up if you see them.'],
  ['how-airplanes-fly', 'science', 'كيف تطير الطائرة؟', 'How do airplanes fly?',
    'المحركات تدفع الطائرة بسرعة كبيرة إلى الأمام. وشكل الجناح مصمَّم بحيث يمرّ الهواء تحته وفوقه بطريقة ترفع الطائرة إلى الأعلى. تماماً كما يرفع الهواء الطائرة الورقية.',
    'The engines push the plane forward very fast. The wing is shaped so air flowing over and under it lifts the plane upward, a bit like the air that lifts a kite.'],
  ['why-ships-float', 'science', 'لماذا تطفو السفن الضخمة؟', 'Why do huge ships float?',
    'السفينة مجوّفة ومليئة بالهواء، فتزيح من الماء كمية تساوي وزنها، والماء يدفعها إلى الأعلى بقوة. لذلك تطفو رغم أنها من الحديد، بينما تغرق قطعة حديد صغيرة صلبة.',
    'A ship is hollow and full of air, so it pushes aside an amount of water as heavy as the ship itself, and the water pushes back up. That is why an iron ship floats while a small solid piece of iron sinks.'],
  ['what-is-internet', 'science', 'ما الإنترنت؟', 'What is the internet?',
    'الإنترنت شبكة ضخمة تربط ملايين الأجهزة حول العالم عبر كابلات وإشارات لاسلكية، لتتبادل الرسائل والصور والفيديو في لحظات. استعمله مع الكبار وانتبه لمعلوماتك الشخصية.',
    'The internet is a giant network that connects millions of devices around the world with cables and wireless signals, so they can swap messages, pictures and videos in moments. Use it with grown-ups and keep your personal information private.'],
  ['what-is-echo', 'science', 'ما الصدى؟', 'What is an echo?',
    'الصوت موجات تنتقل في الهواء. وعندما تصطدم بجدار أو جبل بعيد ترتدّ إليك فتسمع صوتك مرة ثانية، وهذا هو الصدى. جرّب أن تصرخ باسمك في وادٍ أو قاعة كبيرة فارغة.',
    'Sound travels in waves through the air. When the waves hit a faraway wall or mountain they bounce back to you, so you hear your voice again. That is an echo. Try calling your name in a valley or a big empty hall.'],
  ['how-shadows-form', 'science', 'كيف يتكوّن الظل؟', 'How is a shadow made?',
    'الضوء يسير في خطوط مستقيمة ولا يستطيع المرور عبر الأجسام المعتمة. فتتكوّن خلف الجسم منطقة مظلمة بشكله هي الظل. ويطول الظل في الصباح والمساء ويقصر عند الظهر.',
    'Light travels in straight lines and cannot pass through solid objects. So a dark patch the shape of the object appears behind it: a shadow. Shadows are long in the morning and evening and short at noon.'],
  ['why-bubbles-round', 'science', 'لماذا الفقاعات مستديرة؟', 'Why are bubbles round?',
    'غشاء الصابون الرقيق يشدّ نفسه كأنه جلد مطاطي، فيحاول أن يأخذ أصغر مساحة ممكنة حول الهواء داخله. وأصغر مساحة تحيط بحجم معين هي الكرة، لذلك الفقاعة كروية.',
    'The thin soap skin pulls itself tight like stretchy rubber and tries to cover the air inside with as little surface as possible. The shape with the least surface for its size is a sphere, so bubbles are round.'],

  ['why-drink-water', 'habits', 'لماذا نشرب الماء؟', 'Why do we drink water?',
    'أكثر من نصف جسمك ماء! الماء يبرّد الجسم ويوصل الغذاء إلى كل مكان ويساعد على التخلص من الفضلات. اشرب الماء على مدار اليوم، وخاصة عندما تلعب أو يكون الجو حاراً.',
    'More than half of your body is water! Water cools the body, carries food around and helps clear away waste. Sip water through the day, especially when you play or the weather is hot.'],
  ['what-is-recycling', 'habits', 'ما إعادة التدوير؟', 'What is recycling?',
    'بدل أن نرمي الورق والزجاج والعلب المعدنية والبلاستيك، نجمعها وتحوّلها المصانع إلى أشياء جديدة. فنوفّر الأشجار والطاقة ونحافظ على نظافة الأرض. جرّب أن تفرز النفايات في بيتك.',
    'Instead of throwing away paper, glass, cans and plastic, we collect them and factories turn them into new things. We save trees and energy and keep the Earth clean. Try sorting the rubbish at home.'],
  ['why-kindness-matters', 'habits', 'لماذا اللطف مهم؟', 'Why does kindness matter?',
    'كلمة طيبة أو مشاركة لعبة أو مساعدة صديق تجعل من حولك سعداء، وتجعلك سعيداً أنت أيضاً. اللطف لا يكلّف شيئاً، لكنه يصنع فرقاً كبيراً في يوم أحدهم.',
    'A kind word, sharing a toy or helping a friend makes people around you happy and makes you happy too. Kindness costs nothing, yet it can make a big difference in someone\'s day.'],
  ['why-eat-fruit', 'habits', 'لماذا نأكل الفواكه والخضار؟', 'Why do we eat fruit and vegetables?',
    'الفواكه والخضار مليئة بالفيتامينات التي تحمي جسمك وتساعده على النمو وتقوّي عينيك وبشرتك. جرّب كل يوم لوناً جديداً: أحمر وأخضر وبرتقالي وأصفر.',
    'Fruit and vegetables are full of vitamins that protect your body, help it grow and keep your eyes and skin strong. Try a new color every day: red, green, orange and yellow.'],
];

const firstSentence = (text: string): string => {
  const m = /^.+?[.!؟?](\s|$)/.exec(text);
  return (m ? m[0] : text).trim();
};

const CATEGORY_OF_OLD: Record<string, LearnCategory> = {
  'why-sky-blue': 'science',
  'why-magnets-stick': 'science',
  'how-volcanoes-erupt': 'earth',
  'why-we-see-lightning-before-thunder': 'science',
  'why-do-we-yawn': 'body',
  'how-do-plants-eat': 'nature',
};

const FROM_ROWS: LearnCard[] = ROWS.map(([id, cat, titleAr, titleEn, bodyAr, bodyEn]) => ({
  id,
  emoji: '',
  cat,
  title: { ar: titleAr, en: titleEn },
  summary: { ar: firstSentence(bodyAr), en: firstSentence(bodyEn) },
  body: { ar: bodyAr, en: bodyEn },
}));

const FROM_OLD: LearnCard[] = READ_LEARN_ARTICLES.map((a) => ({ ...a, cat: CATEGORY_OF_OLD[a.id] ?? 'science' }));

export const LEARN_CARDS: LearnCard[] = [...FROM_OLD, ...FROM_ROWS];

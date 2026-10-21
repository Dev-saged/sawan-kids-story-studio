import type { StoryType } from '../types';

export interface DailyIdea {
  id: string;
  storyType: StoryType;
  presetId: string;
  title: { ar: string; en: string };
  idea: { ar: string; en: string };
}

export const DAILY_IDEA_DISMISSED_KEY = 'sajed_daily_idea_dismissed_date';

// ب1: مصفوفة ≥ 60 فكرة قصة يومية ثنائية اللغة (64 فكرة) مصنفة بحسب نوع القصة (16 نوعاً) والهوية (16 هوية)
export const DAILY_IDEAS: DailyIdea[] = [
  // 1. Bedtime (قبل النوم) — night / dream / classic / pastel_calm
  {
    id: 'daily-01',
    storyType: 'Bedtime',
    presetId: 'night',
    title: { ar: 'فانوس الغيوم النائمة', en: 'The Lantern of Sleeping Clouds' },
    idea: {
      ar: 'طفل صغير يحمل فانوساً ذهبياً دافئاً يصعد به على سلم من الغيوم القطنية ليغطي النجوم الصغيرة ببطانية المساء قبل أن ينام بسلام.',
      en: 'A gentle child carries a warm golden lantern up a staircase of cotton clouds to tuck the tiny stars under an evening blanket before drifting to sleep.',
    },
  },
  {
    id: 'daily-02',
    storyType: 'Bedtime',
    presetId: 'dream',
    title: { ar: 'همسات جدول القمر', en: 'Whispers of the Moonlit Stream' },
    idea: {
      ar: 'أرنب أبيض صغير يجلس قرب جدول مائي يعكس ضوء القمر الفضي ويستمع إلى تهويدة الرياح الهادئة بين أشجار الصفصاف حتى يغفو مطمئناً.',
      en: 'A little white rabbit sits beside a silver moonlit stream, listening to the soothing lullaby of the breeze through willow trees until falling asleep.',
    },
  },
  {
    id: 'daily-03',
    storyType: 'Bedtime',
    presetId: 'classic',
    title: { ar: 'ساعة الجد الخشبية الدافئة', en: 'Grandfather’s Cozy Wooden Clock' },
    idea: {
      ar: 'في ليلة شتوية دافئة، تدق ساعة الجد الخشبية دقات هادئة متناقصة تروي للطفل حكاية الطيور التي عادت إلى أعشاشها الوثيرة مع حلول المساء.',
      en: 'On a cozy winter evening, grandfather’s wooden clock ticks in a gentle slowing rhythm, telling a child how every bird returns to its warm nest at dusk.',
    },
  },
  {
    id: 'daily-04',
    storyType: 'Bedtime',
    presetId: 'pastel_calm',
    title: { ar: 'فراشة الأحلام الوردية', en: 'The Pastel Dream Butterfly' },
    idea: {
      ar: 'فراشة مضيئة بألوان الباستيل الهادئة تزور نافذة غرفة الطفل عند الغسق وتنثر نسيم السكينة والامتنان على ألعابه المرتبة قبل النوم.',
      en: 'A luminous pastel butterfly visits a child’s window at twilight, sprinkling a gentle breeze of gratitude and calm over the neatly arranged toys before bedtime.',
    },
  },

  // 2. Adventure (مغامرة) — anime_hero / cinema / hakaya / khaleeji
  {
    id: 'daily-05',
    storyType: 'Adventure',
    presetId: 'anime_hero',
    title: { ar: 'بوصلة الرياح المفقودة', en: 'Compass of the Lost Winds' },
    idea: {
      ar: 'بطل شجاع يعثر في علية البيت على بوصلة نحاسية قديمة تشير نحو قمة جبل الضباب، فينطلق مع صديقه الوفي لاكتشاف سر المنارة الهوائية.',
      en: 'A brave young explorer finds an ancient brass compass in the attic pointing toward Mist Peak, setting off with a loyal friend to unlock the wind lighthouse.',
    },
  },
  {
    id: 'daily-06',
    storyType: 'Adventure',
    presetId: 'cinema',
    title: { ar: 'جسر الكريستال المعلّق', en: 'The Suspended Crystal Bridge' },
    idea: {
      ar: 'مغامران صغيران يعبران وادياً مملوءاً بالشلالات المتلألئة لإيصال بذرة شجرة النور النادرة إلى الواحة العالية قبل غروب الشمس.',
      en: 'Two young adventurers cross a valley of sparkling waterfalls to deliver a rare Light-Tree seed to the high oasis before sunset.',
    },
  },
  {
    id: 'daily-07',
    storyType: 'Adventure',
    presetId: 'hakaya',
    title: { ar: 'مفتاح بوابة التين والزيتون', en: 'Key to the Olive Orchard Gate' },
    idea: {
      ar: 'في تلال فلسطين الخضراء، يكتشف طفل ورفيقته خريطة مرسومة على فخار قديم تقودهما عبر المدرجات الحجرية إلى نبع ماء عذب منسي.',
      en: 'Among green Palestinian hills, a child and his friend discover a map on ancient pottery leading them across stone terraces to a forgotten fresh spring.',
    },
  },
  {
    id: 'daily-08',
    storyType: 'Adventure',
    presetId: 'khaleeji',
    title: { ar: 'رحلة اللؤلؤة المضيئة', en: 'Voyage of the Glowing Pearl' },
    idea: {
      ar: 'يبحر فتى صغير مع جده النوخذة على ظهر سفينة خشبية تقليدية في الخليج العربي، ويواجهان الموج بشجاعة لإنقاذ دلفين صغير عالق قرب المرجان.',
      en: 'A young boy sails with his grandfather captain aboard a traditional wooden dhow in the Arabian Gulf, bravely navigating waves to rescue a dolphin near the coral.',
    },
  },

  // 3. Funny (مضحكة) — egyptian / clay_world / pixel_arcade / classic
  {
    id: 'daily-09',
    storyType: 'Funny',
    presetId: 'egyptian',
    title: { ar: 'الببغاء الذي نسي الكلمات', en: 'The Parrot Who Mixed Up Words' },
    idea: {
      ar: 'ببغاء ظريف في حي شعبي مبهج يقرر مساعدة البقال في النداء على الفواكه، لكنه يخلط الأسماء بطريقة مضحكة تجعل الجيران يبتسمون طوال اليوم.',
      en: 'A cheerful parrot in a lively neighborhood tries helping the grocer call out fresh fruits, hilariously mixing up every name and making the whole street laugh.',
    },
  },
  {
    id: 'daily-10',
    storyType: 'Funny',
    presetId: 'clay_world',
    title: { ar: 'كعكة العملاق المنتفخة', en: 'The Giant Bouncing Pancake' },
    idea: {
      ar: 'طباخ صغير متحمس يضع خميرة مضاعفة في عجينة الفطائر، فتنتفخ الفطيرة وتتدحرج في أرجاء المطبخ ككرة مطاطية مرحة يحاول الجميع الإمساك بها.',
      en: 'An eager little chef adds extra yeast to pancake batter, causing the pancake to puff up and bounce around the kitchen like a giant playful ball.',
    },
  },
  {
    id: 'daily-11',
    storyType: 'Funny',
    presetId: 'pixel_arcade',
    title: { ar: 'حذاء القفز العكسي', en: 'The Backwards Jumping Boots' },
    idea: {
      ar: 'يخترع طفل حذاءً ذكياً يساعده على الجري السريع، لكن برمجته تنعكس بالخطأ فيجعله يمشي للخلف ويرقص كلما حاول التوقف في ساحة المدرسة.',
      en: 'A young inventor builds smart running boots whose code accidentally flips, making him moonwalk backward and dance whenever he tries to stop in the schoolyard.',
    },
  },
  {
    id: 'daily-12',
    storyType: 'Funny',
    presetId: 'classic',
    title: { ar: 'القط الذي ظن نفسه أسداً', en: 'The Kitten Who Thought He Was a Lion' },
    idea: {
      ar: 'قط منزلي صغير ينظر في مرآة مكبرة فيظن أنه أسد الغابة المهيب، ويحاول الزئير بصوته الرفيع في مواقف كوميدية لطيفة مع البط والفراشات.',
      en: 'A tiny house kitten looks into a magnifying mirror, believes he is a mighty lion, and tries roaring with a squeaky meow at ducks and butterflies.',
    },
  },

  // 4. Educational (تعليمية) — chalk_school / dream / comic_cyber / iraqi_tigris
  {
    id: 'daily-13',
    storyType: 'Educational',
    presetId: 'chalk_school',
    title: { ar: 'سر قوس قزح في قطرة الماء', en: 'The Rainbow Inside a Water Drop' },
    idea: {
      ar: 'تتساءل طفلة فضولية كيف يظهر قوس قزح بعد المطر، فتجري تجربة بسيطة بمنشور زجاجي وشعاع شمس لتكتشف أسرار انكسار الضوء وألوانه السبعة.',
      en: 'A curious girl wonders how rainbows appear after rain and conducts a sunny prism experiment to discover light refraction and the seven spectrum colors.',
    },
  },
  {
    id: 'daily-14',
    storyType: 'Educational',
    presetId: 'dream',
    title: { ar: 'رحلة البذرة تحت التراب', en: 'Journey of the Little Seed Underground' },
    idea: {
      ar: 'يتابع طفل نمو بذرة عدس في كوب شفاف يوماً بعد يوم، ويكتشف كيف تمتص الجذور الماء وتبحث الأوراق الخضراء عن ضوء الشمس لصنع غذائها.',
      en: 'A child watches a lentil seed sprout in a clear jar day by day, learning how roots drink water and green leaves reach for sunlight to make food.',
    },
  },
  {
    id: 'daily-15',
    storyType: 'Educational',
    presetId: 'comic_cyber',
    title: { ar: 'كيف تتحدث الأقمار الصناعية؟', en: 'How Do Satellites Talk to Earth?' },
    idea: {
      ar: 'فريق طلابي يصمم هوائياً صغيراً في نادي العلوم ويتعلم كيف تنتقل الموجات غير المرئية بسرعة الضوء بين الأرض والأقمار الصناعية في المدار.',
      en: 'A student science club builds a mini receiver and learns how invisible radio waves travel at the speed of light between Earth and orbiting satellites.',
    },
  },
  {
    id: 'daily-16',
    storyType: 'Educational',
    presetId: 'iraqi_tigris',
    title: { ar: 'عجلة الماء في نهر دجلة', en: 'The Ancient Waterwheel of the Tigris' },
    idea: {
      ar: 'يتعرف فتى في بغداد على هندسة النواعير المائية التراثية وكيف ترفع طاقة تدفق النهر المياه لسقاية البساتين العالية دون أي وقود.',
      en: 'A boy by the Tigris River explores traditional waterwheels and discovers how flowing river energy lifts water to irrigate high orchards without fuel.',
    },
  },

  // 5. Moral (أخلاقية) — classic / hakaya / shami / khaleeji
  {
    id: 'daily-17',
    storyType: 'Moral',
    presetId: 'classic',
    title: { ar: 'الأمانة التي أزهرت في الحديقة', en: 'The Honesty That Bloomed in the Garden' },
    idea: {
      ar: 'يعثر طفل على قلم رسم فاخر نسيه زميله في الحديقة، فيقاوم رغبته في الاحتفاظ به ويعيده لصاحبه ليكسب صديقاً وفياً وراحة ضمير جميلة.',
      en: 'A child finds a prized drawing pen left behind in the park, resists keeping it, and returns it to its owner, gaining a true friend and inner peace.',
    },
  },
  {
    id: 'daily-18',
    storyType: 'Moral',
    presetId: 'hakaya',
    title: { ar: 'رغيف الخبز المشترك', en: 'The Shared Loaf of Warm Bread' },
    idea: {
      ar: 'في صباح بارد، يقسم طفل شطيرته الساخنة مع زميله الذي نسي حقيبة طعامه، فيكتشف الفرحة المضاعفة التي يصنعها الكرم والإيثار بين الأصدقاء.',
      en: 'On a chilly morning, a child shares his warm sandwich with a classmate who forgot his lunchbox, discovering the doubled joy of generosity and empathy.',
    },
  },
  {
    id: 'daily-19',
    storyType: 'Moral',
    presetId: 'shami',
    title: { ar: 'اعتذار شجاع عند نافورة الياسمين', en: 'A Brave Apology by the Jasmine Fountain' },
    idea: {
      ar: 'يكسر طفل أصيص ياسمين جدته دون قصد أثناء اللعب، فيختار قول الحقيقة والاعتذار بشجاعة ويساعدها في زراعة شتلة جديدة أجمل.',
      en: 'After accidentally knocking over his grandmother’s jasmine pot while playing, a child chooses honesty, apologizes bravely, and helps plant a new sprout.',
    },
  },
  {
    id: 'daily-20',
    storyType: 'Moral',
    presetId: 'khaleeji',
    title: { ar: 'الكلمة الطيبة تجمع القلوب', en: 'Kind Words Bring Hearts Together' },
    idea: {
      ar: 'يتعلم طفل في المجلس العائلي كيف تحول الكلمة اللطيفة والابتسامة الصادقة سوء تفاهم بسيط بين الأقران إلى تعاون ومحبة دائمة.',
      en: 'During a family gathering, a child learns how gentle words and a sincere smile transform a playground misunderstanding into lasting teamwork.',
    },
  },

  // 6. Mystery (ألغاز وغموض) — pixel_arcade / shami / maghrebi / cinema
  {
    id: 'daily-21',
    storyType: 'Mystery',
    presetId: 'pixel_arcade',
    title: { ar: 'لغز الملاحظات الموسيقية المختفية', en: 'Mystery of the Missing Sheet Music' },
    idea: {
      ar: 'تختفي أوراق اللحن الرئيسي قبل حفل المدرسة بساعة، فيتتبع المحقق الصغير ثلاث قرائن: ريشة زرقاء، وبقايا بذور عباد الشمس، ونافذة مفتوحة.',
      en: 'The lead sheet music vanishes an hour before the school concert, and a young detective follows three clues: a blue feather, sunflower seeds, and an open window.',
    },
  },
  {
    id: 'daily-22',
    storyType: 'Mystery',
    presetId: 'shami',
    title: { ar: 'سر الرسالة المشفرة في المكتبة', en: 'Secret of the Cipher in the Old Library' },
    idea: {
      ar: 'يعثر طفلان بين صفحات أطلس قديم في مكتبة دمشقية على ثلاث بطاقات مرمّزة تقودهم خطوة بخطوة لكشف مكان صندوق التحف الخشبي.',
      en: 'Two children find three coded cards tucked inside an old atlas in a Damascus library, connecting the clues to uncover a hidden wooden treasure box.',
    },
  },
  {
    id: 'daily-23',
    storyType: 'Mystery',
    presetId: 'maghrebi',
    title: { ar: 'أثر الخطوات الملونة في زقاق فاس', en: 'Colored Footprints in the Fez Alleyway' },
    idea: {
      ar: 'في أزقة فاس العتيقة، تختفي سلة الصوف المصبوغ، فيتبع الطفل قطرات اللون النيلي وآثار عربة صغيرة ليحل اللغز بذكاء ومنطق.',
      en: 'In the historic alleys of Fez, a basket of dyed wool goes missing, and a sharp-eyed child follows indigo drops and cart tracks to solve the case.',
    },
  },
  {
    id: 'daily-24',
    storyType: 'Mystery',
    presetId: 'cinema',
    title: { ar: 'لغز إضاءة المرصد الليلي', en: 'The Midnight Observatory Puzzle' },
    idea: {
      ar: 'يلاحظ فتى ومضات ضوئية منتظمة تصدر من قبة المرصد القديم، فيجمع ثلاث دلالات بصرية ليكتشف أن حارس المرصد يختبر عدسة تلسكوب جديدة.',
      en: 'A boy notices rhythmic flashes from the old observatory dome and pieces together three visual clues to discover the keeper testing a new telescope lens.',
    },
  },

  // 7. Fantasy (خيال وسحر) — shami / dream / anime_hero / cinema
  {
    id: 'daily-25',
    storyType: 'Fantasy',
    presetId: 'shami',
    title: { ar: 'مكتبة الكتب التي تطير أجنحتها', en: 'The Library of Winged Books' },
    idea: {
      ar: 'تفتح طفلة باباً خشبياً صغيراً خلف خزانة الكتب فتدخل حديقة سحرية ترفرف فيها القصص كالطيور الملونة وتحتاج إلى قارئ طيب القلب ليعيد ترتيب فصولها.',
      en: 'A girl opens a tiny wooden door behind a bookshelf into an enchanted garden where stories flutter like colorful birds waiting for a kind reader.',
    },
  },
  {
    id: 'daily-26',
    storyType: 'Fantasy',
    presetId: 'dream',
    title: { ar: 'الرسام الذي يلوّن الفصول الأربعة', en: 'The Painter of the Four Seasons' },
    idea: {
      ar: 'يعثر طفل على فرشاة مائية سحرية تعيد اخضرار الأوراق الذابلة، فيتعلم أن استخدامها بحكمة وتوازن يحفظ جمال الفصول الأربعة في الوادي المسحور.',
      en: 'A child discovers a magical watercolor brush that revives wilted leaves, learning that gentle balance preserves the beauty of all four seasons.',
    },
  },
  {
    id: 'daily-27',
    storyType: 'Fantasy',
    presetId: 'anime_hero',
    title: { ar: 'مملكة فواكه النور والياقوت', en: 'Kingdom of Ruby & Starlight Fruits' },
    idea: {
      ar: 'في بستان الأساطير، يتعاون فارس الرمان الشجاع مع أميرة التوت المضيئة لإعادة ينبوع الندى الصافي الذي يمنح أشجار المملكة طاقتها وحياتها.',
      en: 'In the legendary orchard, the brave Pomegranate Knight teams up with the luminous Berry Princess to restore the Pure Dew Spring that sustains the realm.',
    },
  },
  {
    id: 'daily-28',
    storyType: 'Fantasy',
    presetId: 'cinema',
    title: { ar: 'قطار الشفق عبر الغيوم', en: 'The Twilight Cloud Express' },
    idea: {
      ar: 'يتوقف قطار خشبي مضيء يطير فوق الغيوم أمام شرفة طفل حالم، ويأخذه في رحلة خيالية لجمع ألحان الرياح المفقودة وإعادتها لمدينة الموسيقى.',
      en: 'A glowing wooden train soaring above the clouds stops by a dreamer’s balcony, taking him on an enchanted quest to return lost melodies to Music City.',
    },
  },

  // 8. SciFi (خيال علمي وفضاء) — comic_cyber / pixel_arcade / cinema / chalk_school
  {
    id: 'daily-29',
    storyType: 'SciFi',
    presetId: 'comic_cyber',
    title: { ar: 'الروبوت البستاني على كوكب المريخ', en: 'The Gardener Robot on Mars' },
    idea: {
      ar: 'رائدة فضاء صغيرة ومساعدها الروبوت الذكي "زيرو" ينجحان في زراعة أول زهرة عباد شمس داخل القبة الزجاجية على سطح المريخ بفضل الطاقة الشمسية.',
      en: 'A young astronaut and her clever robot helper Zero successfully grow the first sunflower inside a Martian biodome using solar mirrors.',
    },
  },
  {
    id: 'daily-30',
    storyType: 'SciFi',
    presetId: 'pixel_arcade',
    title: { ar: 'مهمة تنظيف مدار النجوم', en: 'Mission: Starlight Orbit Cleanup' },
    idea: {
      ar: 'يبتكر فريق من الأطفال مركبة فضائية مزودة بشباك مغناطيسية ذكية لجمع الحطام الفضائي وحماية محطة الأبحاث العلمية الدائرة حول الأرض.',
      en: 'A team of young cadets pilots a spacecraft with smart magnetic nets to clear orbital debris and protect the international research station.',
    },
  },
  {
    id: 'daily-31',
    storyType: 'SciFi',
    presetId: 'cinema',
    title: { ar: 'مدينة المرجان الذكية تحت المحيط', en: 'The Smart Coral City Under the Sea' },
    idea: {
      ar: 'في عام 2090، يغوص فتى بمركبته الكروية الشفافة إلى محطة أبحاث أعماق المحيط لبرمجة غواصات صغيرة تساعد الشعاب المرجانية على التجدد.',
      en: 'In the year 2090, a boy dives in a transparent sphere sub to an ocean research dome, programming micro-drones that help coral reefs regenerate.',
    },
  },
  {
    id: 'daily-32',
    storyType: 'SciFi',
    presetId: 'chalk_school',
    title: { ar: 'المصعد الكوني إلى القمر', en: 'The Cosmic Elevator to the Moon' },
    idea: {
      ar: 'يفوز طالب مبتكر برحلة علمية عبر المصعد الفضائي نحو قاعدة القمر، حيث يختبر القفز في الجاذبية المنخفضة ويبني مرصداً فلكياً صغيراً.',
      en: 'An inventive student wins a science trip aboard the lunar elevator to Moon Base, testing low-gravity leaps and assembling a mini telescope.',
    },
  },

  // 9. Fable (حكاية حيوانات رمزية) — classic / iraqi_tigris / hakaya / maghrebi
  {
    id: 'daily-33',
    storyType: 'Fable',
    presetId: 'classic',
    title: { ar: 'السلحفاة الحكيمة والسنجاب المتسرع', en: 'The Wise Tortoise and the Hasty Squirrel' },
    idea: {
      ar: 'يجمع السنجاب المتسرع الجوز دون فحصه بينما تنتقي السلحفاة الحكيمة الثمار الناضجة بتأنٍّ، وعند حلول الشتاء يتعلمان معاً قيمة التخطيط والصبر.',
      en: 'A hasty squirrel gathers nuts without checking them while a wise tortoise selects ripe ones carefully, teaching both the value of patience when winter arrives.',
    },
  },
  {
    id: 'daily-34',
    storyType: 'Fable',
    presetId: 'iraqi_tigris',
    title: { ar: 'مالك الحزين والسمكة الذكية', en: 'The Heron and the Clever Little Fish' },
    idea: {
      ar: 'على ضفاف النهر، تتعاون الأسماك الصغيرة مع طائر السنونو لبناء ممر مائي آمن وقت الجفاف، فيتغلب ذكاء الجماعة على الصعاب.',
      en: 'Along the riverbank, little fish cooperate with a swallow to guide water through a safe channel during drought, proving collective wisdom overcomes hardship.',
    },
  },
  {
    id: 'daily-35',
    storyType: 'Fable',
    presetId: 'hakaya',
    title: { ar: 'النحلة التي أرادت العسل وحدها', en: 'The Bee Who Wanted Honey Alone' },
    idea: {
      ar: 'تحاول نحلة صغيرة جمع الرحيق وبناء الخلية بمفردها فتتعب سريعاً، لتدرك أن سر حلاوة العسل وقوة الخلية يكمن في العمل الجماعي المتقن.',
      en: 'A little bee tries gathering nectar and building a comb all by herself, soon realizing the sweetness of honey comes from harmonious teamwork.',
    },
  },
  {
    id: 'daily-36',
    storyType: 'Fable',
    presetId: 'maghrebi',
    title: { ar: 'اللقلق المسافر وعش الصداقة', en: 'The Traveling Stork and the Friendship Nest' },
    idea: {
      ar: 'يعود طائر اللقلق إلى برجه القديم بعد رحلة طويلة ليجد العصافير الصغيرة قد رممت عشه من العواصف، فيرد الجميل بحمايتها بظل جناحيه.',
      en: 'A migratory stork returns to his old tower to find little sparrows repaired his nest after a storm, and he repays their kindness by sheltering them.',
    },
  },

  // 10. Historical (تاريخية وحضارية) — iraqi_tigris / maghrebi / shami / hakaya
  {
    id: 'daily-37',
    storyType: 'Historical',
    presetId: 'iraqi_tigris',
    title: { ar: 'فتى بيت الحكمة في بغداد', en: 'The Young Apprentice of Baghdad’s House of Wisdom' },
    idea: {
      ar: 'في بغداد العصر الذهبي، يساعد فتى شغوف بالعلم الفلكيين والنسّاخين في بيت الحكمة على رسم خريطة دقيقة للنجوم وإتقان صناعة الورق الصافي.',
      en: 'In Golden Age Baghdad, a curious apprentice assists astronomers and scribes at the House of Wisdom in charting star maps and crafting fine paper.',
    },
  },
  {
    id: 'daily-38',
    storyType: 'Historical',
    presetId: 'maghrebi',
    title: { ar: 'ساعة الفيل المائية والمهندس الصغير', en: 'The Elephant Water Clock & the Young Engineer' },
    idea: {
      ar: 'يتأمل طفل ذكي كيف صمم العالم الجزري ساعة الفيل المائية العجيبة بتروسها الدقيقة، وينجح في إصلاح صمام الماء الصغير ليقرع الطائر الذهبي في موعده.',
      en: 'A bright child studies Al-Jazari’s marvelous Elephant Water Clock and helps adjust its float valve so the mechanical bird chimes right on time.',
    },
  },
  {
    id: 'daily-39',
    storyType: 'Historical',
    presetId: 'shami',
    title: { ar: 'قنديل القراءة في قرطبة', en: 'The Reading Lantern of Cordoba' },
    idea: {
      ar: 'في شوارع قرطبة المضاءة بالقناديل، ترافق طفلة والدها الخطاط إلى سوق الوراقين وتتعلم كيف تُزخرف المخطوطات بماء الذهب والألوان الطبيعية.',
      en: 'Along the lamp-lit streets of historic Cordoba, a girl accompanies her calligrapher father to the bookbinders’ market to learn gold-leaf illumination.',
    },
  },
  {
    id: 'daily-40',
    storyType: 'Historical',
    presetId: 'hakaya',
    title: { ar: 'قافلة التجار وأسوار عكا التاريخية', en: 'The Merchant Caravan & Historic Acre' },
    idea: {
      ar: 'فتى يساعد جده صانع البوصلات البحرية في ميناء عكا التاريخي، ويتعلم كيف اهتدى البحارة العرب بالنجوم والأسطرلاب عبر البحار بأمان.',
      en: 'A boy helps his compass-maker grandfather in historic Acre harbor, learning how Arab navigators used stars and the astrolabe to sail safely.',
    },
  },

  // 11. Rhyme (شعرية مقفّاة / سجع) — classic / shami / egyptian / night
  {
    id: 'daily-41',
    storyType: 'Rhyme',
    presetId: 'classic',
    title: { ar: 'أنشودة المطر والزهر في البستان', en: 'Rhyme of the Rain and Garden Blossoms' },
    idea: {
      ar: 'حكاية مسجوعة مقفّاة عن قطرة مطر صافية تنزل من الغمام، فتوقظ البراعم النائمة في البستان وتغني معها الطيور بأعذب الألحان.',
      en: 'A musical rhyming tale about a pure raindrop falling from the clouds to awaken sleeping garden buds while songbirds chant along in rhythm.',
    },
  },
  {
    id: 'daily-42',
    storyType: 'Rhyme',
    presetId: 'shami',
    title: { ar: 'نغم البلبل على غصن اللوز', en: 'The Nightingale’s Verse on the Almond Branch' },
    idea: {
      ar: 'قصة بإيقاع شعري جميل عن بلبل فصيح ينشد في الصباح فوق أزهار اللوز البيضاء، ويعلم الأطفال حب الطبيعة والعمل بنشاط وصفاء.',
      en: 'A lyrical rhyming story of a cheerful nightingale singing atop white almond blossoms at dawn, inspiring children with joy and diligence.',
    },
  },
  {
    id: 'daily-43',
    storyType: 'Rhyme',
    presetId: 'egyptian',
    title: { ar: 'مركب النيل وغنوة النسيم', en: 'The Nile Sailboat’s Cheerful Song' },
    idea: {
      ar: 'حكاية موزونة ذات قافية رشيقة عن مركب شراعي أبيض ينساب فوق مياه النيل عند الأصيل، ويحيي النخيل والطيور بنغم جميل.',
      en: 'A bouncy rhyming story about a white felucca gliding across the Nile at sunset, greeting palm trees and river birds in musical verse.',
    },
  },
  {
    id: 'daily-44',
    storyType: 'Rhyme',
    presetId: 'night',
    title: { ar: 'موشح النجوم في سماء الليل', en: 'Lullaby Couplets of the Starry Sky' },
    idea: {
      ar: 'قصة مسائية مقفّاة بإيقاع هادئ عذب تروي كيف تصطف النجوم في السماء كاللآلئ المضيئة وتهمس للطفل الصغير بأحلام هانئة.',
      en: 'A gentle bedtime rhyme describing how stars line up like glowing pearls across the night sky, whispering peaceful dreams to the sleepy child.',
    },
  },

  // 12. Interactive (تفاعلية وتفكير) — chalk_school / pixel_arcade / egyptian / clay_world
  {
    id: 'daily-45',
    storyType: 'Interactive',
    presetId: 'chalk_school',
    title: { ar: 'أين اختبأت المفاتيح الملونة؟', en: 'Where Are the Colorful Keys Hidden?' },
    idea: {
      ar: 'رحلة تفاعلية يبحث فيها البطل مع القارئ الصغير عن ثلاثة مفاتيح ملونة داخل متحف العلوم، وفي كل صفحة سؤال ملاحظة ذكي يساعد على فتح الباب التالي.',
      en: 'An interactive quest where the hero and young reader search for three colored keys inside a science museum, solving an observation question on every page.',
    },
  },
  {
    id: 'daily-46',
    storyType: 'Interactive',
    presetId: 'pixel_arcade',
    title: { ar: 'اختر الطريق في جزيرة الأحاجي', en: 'Spot the Clue on Riddle Island' },
    idea: {
      ar: 'يصل المستكشف الصغير إلى جزيرة الأحاجي اللطيفة ويحتاج إلى مساعدة الطفل القارئ في ملاحظة تفاصيل الرسوم لاختيار الجسر الصحيح في كل مشهد.',
      en: 'A young explorer arrives on friendly Riddle Island and asks the reader to spot visual clues in each scene to choose the safe bridge forward.',
    },
  },
  {
    id: 'daily-47',
    storyType: 'Interactive',
    presetId: 'egyptian',
    title: { ar: 'ساعد الشيف الصغير في ترتيب المكونات', en: 'Help the Little Chef Count the Ingredients' },
    idea: {
      ar: 'يعد الشيف الصغير فطيرة الفواكه الطازجة لأصدقائه، ويسأل القارئ في نهاية كل صفحة عن الألوان والأعداد والمكونات الظاهرة في المطبخ.',
      en: 'A little chef prepares a fresh fruit tart for friends, asking the young reader fun counting and color-spotting questions on every page.',
    },
  },
  {
    id: 'daily-48',
    storyType: 'Interactive',
    presetId: 'clay_world',
    title: { ar: 'من طرق باب بيت الشجرة؟', en: 'Who Knocked on the Treehouse Door?' },
    idea: {
      ar: 'في كل صفحة يظهر ظل أو أثر قدم حيوان لطيف قرب بيت الشجرة، ويفكر القارئ الصغير مع البطل لمعرفة الضيف القادم إلى حفلة الشاي.',
      en: 'Each page reveals a friendly pawprint or silhouette near the treehouse, inviting the child reader to guess which woodland guest arrived for tea.',
    },
  },

  // 13. Therapeutic (تربوية وعلاجية للنفس) — pastel_calm / dream / night / classic
  {
    id: 'daily-49',
    storyType: 'Therapeutic',
    presetId: 'pastel_calm',
    title: { ar: 'تنفّس الغيمة: عندما أشعر بالقلق', en: 'Cloud Breathing: When I Feel Worried' },
    idea: {
      ar: 'يشعر طفل بقلق وتردد في أول يوم بنادي الرسم الجديد، فتعلمه المعلمة الحكيمة تمرين التنفس العميق كالغيمة الهادئة حتى يستعيد ثقته وابتسامته.',
      en: 'A child feels nervous on the first day of art club, and a caring teacher guides him through calm cloud-breathing exercises until confidence blooms.',
    },
  },
  {
    id: 'daily-50',
    storyType: 'Therapeutic',
    presetId: 'dream',
    title: { ar: 'صندوق الشجاعة في الظلام', en: 'The Courage Lantern in the Dark' },
    idea: {
      ar: 'طفلة تخاف من الظلال الليلية في غرفتها، فيجلس معها والدها بهدوء لتسمية شعورها ويكتشفان معاً كيف تتحول الظلال إلى أشكال أليفة مع التنفس الهادئ.',
      en: 'A girl afraid of nighttime shadows in her room sits with her father to name the feeling and practice a soothing grounding game that turns shadows friendly.',
    },
  },
  {
    id: 'daily-51',
    storyType: 'Therapeutic',
    presetId: 'night',
    title: { ar: 'بركان الغضب الصغير وكوب الماء البارد', en: 'Cooling Down the Little Anger Volcano' },
    idea: {
      ar: 'عندما تنهار قلعة المكعبات يشعر الطفل بغضب شديد، فتحتويه والدته بلطف وتعلمه العد البطيء إلى خمسة مع أخذ نفس عميق ليعيد بناء قلعته بهدوء.',
      en: 'When a block tower tumbles, a child feels a rush of anger; his mother validates his feeling and teaches him slow five-finger breathing to rebuild calmly.',
    },
  },
  {
    id: 'daily-52',
    storyType: 'Therapeutic',
    presetId: 'classic',
    title: { ar: 'مكاني الآمن عندما يعلو الضجيج', en: 'My Safe Cozy Corner When Things Get Loud' },
    idea: {
      ar: 'طفل حساس للأصوات العالية يتعلم كيف يعبر عن حاجته للهدوء دون خجل، ويطبق مهارة التركيز على خمسة أشياء جميلة حوله ليشعر بالطمأنينة.',
      en: 'A sensitive child overwhelmed by loud noise learns to ask for quiet time and uses the five-senses grounding exercise to feel safe and calm.',
    },
  },

  // 14. Prophets (قصص الأنبياء والسيرة) — classic / khaleeji / shami / hakaya
  {
    id: 'daily-53',
    storyType: 'Prophets',
    presetId: 'classic',
    title: { ar: 'سفينة النجاة والخشب المتين', en: 'The Ark of Salvation and Patience' },
    idea: {
      ar: 'قصة إيمانية بأدب رفيع عن صبر نبي الله نوح عليه السلام وبناء السفينة العظيمة وسط البراري، ثم استقرارها بأمان وسلام تحت قوس المطر المشرق دون تجسيد.',
      en: 'A reverent story of Prophet Nuh’s patience and the building of the great Ark, resting safely after the flood beneath radiant light without figurative depiction.',
    },
  },
  {
    id: 'daily-54',
    storyType: 'Prophets',
    presetId: 'khaleeji',
    title: { ar: 'بئر زمزم المباركة في الوادي', en: 'The Blessed Well of Zamzam in the Valley' },
    idea: {
      ar: 'سرد روحاني مؤثر لقصة تفجّر ماء زمزم المبارك في وادي مكة القفر استجابةً للتوكل على الله والصبر، مع مشاهد طبيعية ونورانية مهيبة.',
      en: 'An inspiring account of how the blessed waters of Zamzam sprang forth in the barren valley of Makkah through faith and perseverance, depicted through sacred landscapes.',
    },
  },
  {
    id: 'daily-55',
    storyType: 'Prophets',
    presetId: 'shami',
    title: { ar: 'حكمة سليمان عليه السلام ووادي النمل', en: 'Wisdom in the Valley of the Ants' },
    idea: {
      ar: 'قصة النملة الحكيمة التي حذرت قومها بنظام وتعاون في وادي النمل، وما فيها من دروس الرحمة بالحيوان والشكر لله على نعمه العظيمة.',
      en: 'The story of the wise ant who warned her colony in the Valley of the Ants, highlighting lessons of compassion toward creatures and gratitude to God.',
    },
  },
  {
    id: 'daily-56',
    storyType: 'Prophets',
    presetId: 'hakaya',
    title: { ar: 'غار ثور وخيوط العنكبوت والحمامتين', en: 'The Cave of Thawr and the Shield of Peace' },
    idea: {
      ar: 'لوحة سردية مؤثرة من السيرة النبوية العطرة عن الطمأنينة والسكينة في غار ثور، وكيف نسجت العنكبوت خيوطها عند فم الغار في مشهد طبيعي مهيب.',
      en: 'A dignified Seerah account of peace and trust at the Cave of Thawr, depicting the spider web and nesting doves at the cave entrance in radiant nature.',
    },
  },

  // 15. Folklore (تراث وحكايات شعبية) — hakaya / shami / iraqi_tigris / maghrebi
  {
    id: 'daily-57',
    storyType: 'Folklore',
    presetId: 'hakaya',
    title: { ar: 'حكاية جرة الزيت الكريمة في القرية', en: 'The Generous Olive Jar of the Village' },
    idea: {
      ar: 'كان يا ما كان في قرية فلسطينية وادعة، يتعاون الجيران في موسم قطاف الزيتون لمساعدة جارتهم المسنة، فتفيض البركة والخير في بيوت القرية كلها.',
      en: 'Once upon a time in a peaceful Palestinian village, neighbors unite during the olive harvest to help an elderly neighbor, bringing abundance to every home.',
    },
  },
  {
    id: 'daily-58',
    storyType: 'Folklore',
    presetId: 'shami',
    title: { ar: 'حكواتي الحارة وصندوق الحكايات', en: 'The Neighborhood Hakawati’s Wonder Box' },
    idea: {
      ar: 'في فناء بيت دمشقي عتيق، يجمع الحكواتي أطفال الحارة حول نافورة الماء ليروي لهم حكاية التاجر الأمين الذي ربح محبة الناس بصدقه ووفائه.',
      en: 'In a traditional Damascene courtyard, the Hakawati gathers children around the fountain to tell the folk tale of an honest merchant whose integrity won hearts.',
    },
  },
  {
    id: 'daily-59',
    storyType: 'Folklore',
    presetId: 'iraqi_tigris',
    title: { ar: 'فانوس الصياد الكهل على شاطئ النهر', en: 'The Old Fisherman’s Lantern by the River' },
    idea: {
      ar: 'حكاية تراثية دافئة عن صياد طيب يعلق فانوساً منيراً على قاربه كل مساء ليرشد القوارب العابرة، فيكافئه أهل الضفتين بهدية لا تُنسى.',
      en: 'A warm folk tale of a kind fisherman who hangs a bright lantern on his boat every evening to guide river travelers, earning a heartfelt community gift.',
    },
  },
  {
    id: 'daily-60',
    storyType: 'Folklore',
    presetId: 'maghrebi',
    title: { ar: 'سجادة الحكمة ذات الألوان السبعة', en: 'The Seven-Colored Carpet of Wisdom' },
    idea: {
      ar: 'نسّاجة ماهرة في قرية أطلسية تعلم حفيدتها أن كل خيط ملون في الزربية التراثية يرمز لقيمة نبيلة كالصبر والكرم وحب الأرض.',
      en: 'A master weaver in an Atlas village teaches her granddaughter how each colored thread in a traditional carpet symbolizes patience, generosity, and heritage.',
    },
  },

  // 16. Sports (رياضة وروح الفريق) — anime_hero / egyptian / khaleeji / clay_world
  {
    id: 'daily-61',
    storyType: 'Sports',
    presetId: 'anime_hero',
    title: { ar: 'التمريرة الحاسمة في الدقيقة الأخيرة', en: 'The Decisive Pass in the Final Minute' },
    idea: {
      ar: 'في نهائي بطولة المدرسة لكرة القدم، يفضل قائد الفريق تمرير الكرة لزميله المتمركز بدلاً من التسديد الفردي، ليحقق الفريق الفوز بروح التعاون.',
      en: 'In the school soccer final, the team captain chooses to pass the ball to an open teammate instead of shooting alone, winning through true teamwork.',
    },
  },
  {
    id: 'daily-62',
    storyType: 'Sports',
    presetId: 'egyptian',
    title: { ar: 'سباق الدراجات والروح الرياضية', en: 'The Bicycle Race & True Sportsmanship' },
    idea: {
      ar: 'أثناء سباق الدراجات في النادي، يتوقف المتسابق المتقدم لمساعدة منافسه الذي سقطت دراجته، ويعبران خط النهاية معاً وسط تصفيق الجميع.',
      en: 'During a club cycling race, the leading rider stops to help a rival whose bike slipped, and both cross the finish line together to cheering applause.',
    },
  },
  {
    id: 'daily-63',
    storyType: 'Sports',
    presetId: 'khaleeji',
    title: { ar: 'فريق السباحة وتحدي التتابع', en: 'The Swimming Relay Team Challenge' },
    idea: {
      ar: 'يتدرب أربعة أصدقاء بجد في المسبح الأولمبي لتنسيق انطلاقتهم في سباق التتابع، ويتعلمون أن تشجيع كل فرد لزميله يصنع الأبطال الحقيقيين.',
      en: 'Four friends train diligently in the pool to synchronize their relay handoffs, learning that encouraging every teammate builds real champions.',
    },
  },
  {
    id: 'daily-64',
    storyType: 'Sports',
    presetId: 'clay_world',
    title: { ar: 'بطولة تنس الطاولة والتركيز الهادئ', en: 'Table Tennis Championship & Calm Focus' },
    idea: {
      ar: 'تتعلم لاعبة صغيرة في بطولة تنس الطاولة كيف تحول التوتر بعد خسارة الشوط الأول إلى تركيز هادئ وابتسامة رياضية تقودها للتألق.',
      en: 'A young table tennis player learns to turn first-set jitters into calm focus and good sportsmanship, rallying back with a cheerful smile.',
    },
  },
];

export const getTodayDateKey = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const hashSeed = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};

/**
 * ب1: اختيار فكرة اليوم محلياً بلا أي طلب API، بـ seed من تاريخ اليوم والهوية المحفوظة
 * بحيث تعطي نفس الفكرة طوال اليوم لنفس التاريخ والهوية، وزر «فكرة أخرى» يدور محلياً عبر offset.
 */
export const pickDailyIdea = (
  date: Date = new Date(),
  presetId = 'classic',
  offset = 0
): DailyIdea => {
  const dateKey = getTodayDateKey(date);
  const cleanPreset = (presetId || 'classic').trim();
  const seed = hashSeed(`${dateKey}::${cleanPreset}`);
  const safeOffset = Math.max(0, Math.floor(offset));

  if (safeOffset === 0) {
    const matchingPreset = DAILY_IDEAS.filter((item) => item.presetId === cleanPreset);
    if (matchingPreset.length > 0) {
      return matchingPreset[seed % matchingPreset.length];
    }
  }

  const baseIdx = seed % DAILY_IDEAS.length;
  return DAILY_IDEAS[(baseIdx + safeOffset) % DAILY_IDEAS.length];
};

export const isDailyIdeaDismissedToday = (date: Date = new Date()): boolean => {
  try {
    const stored = localStorage.getItem(DAILY_IDEA_DISMISSED_KEY);
    return stored === getTodayDateKey(date);
  } catch {
    return false;
  }
};

export const dismissDailyIdeaForToday = (date: Date = new Date()): void => {
  try {
    localStorage.setItem(DAILY_IDEA_DISMISSED_KEY, getTodayDateKey(date));
  } catch {
    // ignore storage errors
  }
};

import { PageImage, StoryData } from '../../types';
import { toSrc } from '../../services/media';
import { BRAND } from '../../config';

interface Props {
  storyData: StoryData;
  images: PageImage[];
  containerId: string;
}

export default function PrintableStory({ storyData, images, containerId }: Props) {
  const ar = storyData.story_info.language?.toLowerCase().includes('arabic');
  const dir = ar ? 'rtl' : 'ltr';
  const fontFamily = ar
    ? "'Cairo', 'Baloo Bhaijaan 2', sans-serif"
    : "'Nunito', 'Fredoka', sans-serif";
  const displayFont = ar
    ? "'Baloo Bhaijaan 2', 'Cairo', sans-serif"
    : "'Fredoka', 'Nunito', sans-serif";

  const imageByPage = new Map(images.map((img) => [img.page, img.base64]));
  const coverImage = toSrc(storyData.coverImage || imageByPage.get(1) || images[0]?.base64);

  return (
    <div
      id={containerId}
      style={{
        position: 'fixed',
        top: 0,
        left: -10000,
        zIndex: -9999,
        pointerEvents: 'none',
        opacity: 0.01,
        visibility: 'visible',
        width: 800,
        overflow: 'hidden',
        background: '#ffffff',
      }}
      aria-hidden
    >
      {/* Cover Page */}
      <div
        data-print-page
        dir={dir}
        style={{
          width: 800,
          height: 1050,
          background: 'linear-gradient(180deg, #fefbf6 0%, #ffffff 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '48px 50px',
          fontFamily,
          position: 'relative',
          border: '1px solid #eee',
          pageBreakAfter: 'always',
        }}
      >
        {/* Top Header Branding */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f0a202', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            {ar ? BRAND.fullName.ar : BRAND.fullName.en}
          </span>
          <span style={{ fontSize: 13, color: '#8a8194', fontWeight: 600 }}>
            {storyData.story_info.art_style || 'Illustrated Edition'}
          </span>
        </div>

        {/* Story Title */}
        <div style={{ textAlign: 'center', margin: '16px 0 28px' }}>
          <h1
            style={{
              fontFamily: displayFont,
              fontSize: 38,
              fontWeight: 800,
              color: '#241b2f',
              margin: '0 0 10px',
              lineHeight: 1.3,
            }}
          >
            {storyData.story_info.title}
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ background: '#fef3d6', color: '#b26e00', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              {ar ? `الفئة: ${storyData.story_info.age_group} سنوات` : `Ages ${storyData.story_info.age_group}`}
            </span>
            <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              {storyData.story_info.art_style}
            </span>
          </div>
        </div>

        {/* Cover Illustration */}
        {coverImage && (
          <div
            style={{
              width: '100%',
              height: 480,
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              border: '4px solid #ffffff',
              marginBottom: 30,
              background: '#f8f4fc',
            }}
          >
            <img
              src={coverImage}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Characters & Moral summary */}
        <div style={{ marginTop: 'auto', background: '#f8f5fc', borderRadius: 18, padding: '16px 20px', border: '1px solid #ebdff5' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4a3b63', marginBottom: 6 }}>
            {ar ? 'أبطال القصة:' : 'Characters:'}
          </div>
          <div style={{ fontSize: 12, color: '#594d70', lineHeight: 1.6 }}>
            {storyData.characters.map((c) => `${c.name} (${c.description})`).join(' • ')}
          </div>
          {storyData.story_info.lessons?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f0a202', fontWeight: 600 }}>
              {ar ? 'القيم المستفادة: ' : 'Themes: '}
              {storyData.story_info.lessons.join(' • ')}
            </div>
          )}
        </div>
      </div>

      {/* Story Pages */}
      {storyData.pages.map((page) => {
        const pageImg = toSrc(imageByPage.get(page.page));
        return (
          <div
            key={page.page}
            data-print-page
            dir={dir}
            style={{
              width: 800,
              height: 1050,
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              padding: '44px 50px',
              fontFamily,
              position: 'relative',
              border: '1px solid #eee',
              pageBreakAfter: 'always',
            }}
          >
            {/* Top Page Running Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8a8194', maxWidth: '75%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {storyData.story_info.title}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f0a202', background: '#fff7e6', padding: '3px 12px', borderRadius: 999 }}>
                {ar ? `الصفحة ${page.page}` : `Page ${page.page}`}
              </span>
            </div>

            {/* Page Illustration */}
            {pageImg && (
              <div
                style={{
                  width: '100%',
                  height: 520,
                  borderRadius: 20,
                  overflow: 'hidden',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                  background: '#f8f4fc',
                  marginBottom: 28,
                }}
              >
                <img
                  src={pageImg}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            {/* Page Story Text */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p
                style={{
                  fontSize: 23,
                  lineHeight: 1.8,
                  color: '#241b2f',
                  margin: 0,
                  textAlign: dir === 'rtl' ? 'right' : 'left',
                }}
              >
                {page.text}
              </p>
            </div>

            {/* Running Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid #f1ecf7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#a098aa' }}>
                {ar ? `${BRAND.fullName.ar} — تصميم وتطوير ${BRAND.author.ar}` : `${BRAND.fullName.en} — by ${BRAND.author.en}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#241b2f' }}>
                {page.page} / {storyData.pages.length}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

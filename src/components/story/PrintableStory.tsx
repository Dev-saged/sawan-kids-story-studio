import { PageImage, StoryData } from '../../types';

interface Props {
  storyData: StoryData;
  images: PageImage[];
  containerId: string;
}

export default function PrintableStory({ storyData, images, containerId }: Props) {
  const dir = storyData.story_info.language?.toLowerCase().includes('arabic') ? 'rtl' : 'ltr';
  const imageByPage = new Map(images.map((img) => [img.page, img.base64]));

  return (
    <div id={containerId} style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none' }} aria-hidden>
      {storyData.pages.map((page) => (
        <div
          key={page.page}
          data-print-page
          dir={dir}
          style={{
            width: 900,
            height: 900,
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: dir === 'rtl' ? "'Cairo', sans-serif" : "'Nunito', sans-serif",
          }}
        >
          {imageByPage.get(page.page) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                imageByPage.get(page.page)!.startsWith('data:')
                  ? imageByPage.get(page.page)!
                  : imageByPage.get(page.page)!.startsWith('PHN2') || imageByPage.get(page.page)!.startsWith('PD94')
                  ? `data:image/svg+xml;base64,${imageByPage.get(page.page)}`
                  : `data:image/png;base64,${imageByPage.get(page.page)}`
              }
              alt=""
              style={{ width: '100%', height: 620, objectFit: 'cover' }}
            />
          )}
          <p style={{ padding: '28px 32px', fontSize: 26, lineHeight: 1.7, color: '#241b2f', margin: 0 }}>{page.text}</p>
          <span style={{ marginTop: 'auto', padding: '0 32px 20px', fontSize: 14, color: '#8a8194' }}>{page.page}</span>
        </div>
      ))}
    </div>
  );
}

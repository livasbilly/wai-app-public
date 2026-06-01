import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const images: { filename: string; contentType: string; base64: string }[] = [];

    // Custom image handler to extract embedded pictures
    const options = {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageBuffer = await image.read();
        const ext = image.contentType.split('/')[1] || 'png';
        // Unique image name based on timestamp and sequence
        const filename = `image_${Date.now()}_${images.length}.${ext}`;
        const base64Data = imageBuffer.toString('base64');
        const dataUrl = `data:${image.contentType};base64,${base64Data}`;

        images.push({
          filename,
          contentType: image.contentType,
          base64: dataUrl,
        });

        // Link inside Markdown pointing to the relative local images/ folder
        return {
          src: `images/${filename}`
        };
      })
    };

    // Convert Word Doc to HTML and extract images
    const result = await mammoth.convertToHtml({ buffer }, options);
    const html = result.value;

    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    // Set custom rule to handle images and ensure they are parsed as ![alt](src) properly
    const markdown = turndownService.turndown(html);

    return NextResponse.json({
      markdown,
      images,
      warnings: result.messages
    });
  } catch (err: any) {
    console.error('docx import api error:', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}

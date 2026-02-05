import { NextRequest, NextResponse } from 'next/server';

const ICON_STYLE_PROMPT = `
Style requirements:
- Perspective: isometric view (same angle as city builder games)
- Canvas: square with object centered, fitting comfortably within margins
- Composition: single dominant building/object, 2-4 architectural elements
- Lighting: soft ambient light from top-right, gentle drop shadows
- Textures: semi-matte surfaces, stylized naturalism
- Render: high-quality 3D style, crisp edges without outlines
- Colors: naturalistic with slight saturation boost, harmonious muted tones
- Background: transparent (PNG)
- Style: clean, premium, friendly - suitable for city builder game
- The building should be viewed from the standard isometric angle (roughly 30 degrees)
- Base of building should be visible and align with isometric diamond grid
`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, footprintWidth = 1, footprintHeight = 1 } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Build the full prompt
    const sizeDescription = footprintWidth > 1 || footprintHeight > 1
      ? `This is a large building that occupies a ${footprintWidth}x${footprintHeight} tile footprint.`
      : 'This is a single-tile building.';

    const fullPrompt = `Generate an isometric game asset: "${prompt}"

${sizeDescription}

${ICON_STYLE_PROMPT}`;

    // Call OpenAI's image generation API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to generate image' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const imageBase64 = data.data[0].b64_json;

    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${imageBase64}`,
      revisedPrompt: data.data[0].revised_prompt,
    });
  } catch (error) {
    console.error('Error generating sprite:', error);
    return NextResponse.json(
      { error: 'Failed to generate sprite' },
      { status: 500 }
    );
  }
}

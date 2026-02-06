import { NextRequest, NextResponse } from "next/server";

const ICON_STYLE_JSON = {
  icon_style: {
    perspective: "isometric (standard city builder angle, roughly 30 degrees)",
    geometry: {
      proportions:
        "1:1 ratio canvas, with objects fitting comfortably within margins",
      element_arrangement:
        "central dominant object, vertically centered in canvas",
      ground_base: "DO NOT include any ground, grass, floor, platform, or isometric diamond base - the object should float on transparent background, unless instructed for specifically the diamond base floor tile",
    },
    composition: {
      element_count: "2-4 main architectural elements, unless instructed with many more",
      spatial_depth: "layered to create sense of dimension and slight elevation",
      scale_consistency: "uniform object scale across icon set",
      scene_density: "minimal to moderate, maintaining clarity and visual focus",
    },
    lighting: {
      type: "soft ambient light",
      light_source: "subtle top-right or front-top direction",
      shadow: "gentle drop shadows below and behind objects",
      highlighting: "mild edge illumination to define forms",
    },
    textures: {
      material_finish: "semi-matte to satin surfaces",
      surface_treatment:
        "smooth with light tactile variation (e.g., wood grain, soft textures)",
      texture_realism: "stylized naturalism without hyper-realistic noise",
    },
    render_quality: {
      resolution: "high-resolution octane 3D rendering",
      edge_definition:
        "crisp, no outlines; separation achieved via lighting and depth",
      visual_clarity: "clean, readable shapes with minimal clutter",
    },
    color_palette: {
      tone: "naturalistic with slight saturation boost",
      range: "harmonious muted tones with gentle contrast",
      usage:
        "distinct colors per object to improve identification and readability",
    },
    background: "transparent",
    stylistic_tone:
      "premium, friendly, clean - suitable for city builder game",
    icon_behavior: {
      branding_alignment: "neutral enough for broad applications",
      scalability: "legible at small and medium sizes",
      interchangeability:
        "part of a cohesive icon system with interchangeable subject matter",
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      footprintWidth = 1,
      footprintHeight = 1,
      apiKey: providedApiKey,
    } = await request.json();

    // Use provided API key from request, fallback to environment variable
    const apiKey = providedApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key not provided. Please set your API key in the UI or configure OPENAI_API_KEY environment variable.",
        },
        { status: 400 }
      );
    }

    // Build the full prompt with JSON style
    const sizeDescription =
      footprintWidth > 1 || footprintHeight > 1
        ? `This is a large building that occupies a ${footprintWidth}x${footprintHeight} tile footprint.`
        : "This is a single-tile building.";

    const fullPrompt = `Generate a "${prompt}" icon with this json style:
${JSON.stringify(ICON_STYLE_JSON, null, 2)}

${sizeDescription}

CRITICAL: Do NOT include any ground, grass, dirt, platform, or isometric diamond base. The object should be rendered alone on a completely transparent background, as if floating. The game will place this sprite on its own grid tiles.`;

    // Call OpenAI's image generation API
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt: fullPrompt,
        quality: "high",
        size: "1024x1024",
        background: "transparent",
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      let errorMessage = "Failed to generate image";
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = `API error: ${response.status} - ${responseText.slice(0, 200)}`;
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
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

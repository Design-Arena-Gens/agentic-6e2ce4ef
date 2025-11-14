import OpenAI from "openai";
import { NextResponse } from "next/server";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt =
  "You are Jarvis, a proactive AI operator assisting a human controller. " +
  "Respond with concise, actionable intelligence. Prefer structured sections " +
  'titled \"Situation\", \"Analysis\", \"Next Actions\" when relevant. Maintain a confident tone.';

type PayloadMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function normalizePayloadMessages(messages: PayloadMessage[]) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured on the server.",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { messages?: unknown }).messages)
  ) {
    return NextResponse.json(
      { error: "Body must include a messages array." },
      { status: 400 },
    );
  }

  const rawMessages = (body as { messages: PayloadMessage[] }).messages;
  const sanitizedMessages = normalizePayloadMessages(rawMessages);

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      stream: true,
      temperature: 0.6,
      messages: sanitizedMessages,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of completion) {
            const content = part.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Jarvis inference failure", error);
    return NextResponse.json(
      { error: "Jarvis failed to complete the directive." },
      { status: 500 },
    );
  }
}

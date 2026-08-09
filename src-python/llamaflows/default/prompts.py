ARTIFACT_PROMPT = """You are an AI assistant tasked with generating a new artifact based on the users request.
Ensure you use markdown syntax when appropriate, as the text you generate will be rendered in markdown.

Follow these rules and guidelines:
<rules-guidelines>
- Use all available context to generate artifact.
- If writing code, do not add inline comments unless the user has specifically requested them. This is very important as we don't want to clutter the code.
- Make sure you fulfill ALL aspects of a user's request.
- Return only the complete artifact content in markdown. Do not include a followup message, explanation, wrapper, delimiter, or metadata.
</rules-guidelines>

User Request:
{user_query}

Chat History:
{chat_history}

Web Context:
{web_context}

Current Artifact:
{artifact_context}

Artifact Markdown: """

WEB_ROUTER_PROMPT = """You are routing a user request before an artifact generation workflow.

Return exactly one string:
TASK
QUERY

Choose TASK when the user only wants transformation, formatting, rewriting, or action using existing chat/artifact context.
Choose QUERY when the user asks an open question or wants to extend, correct, verify, update, modify, or enrich the answer or artifact with outside information.

User Request:
{user_query}

Chat History:
{chat_history}

Current Artifact:
{artifact_context}

Route: """

SEARCH_QUERY_PROMPT = """You are preparing concise web search queries for a research workflow.

Extract the key themes, entities, facts, or topics from the user's request and convert them into concise search queries.

Return structured JSON matching exactly this shape:
{"search_query":["query1"]}

Rules:
- Use the fewest useful queries.
- Generate at most 3 queries.
- Do not repeat the same topic in multiple queries.
- Prefer short, searchable phrases over the full user request.
- Keep named entities, product names, dates, locations, and technical terms when they matter.

User Request:
{user_query}"""

FOLLOWUP_PROMPT = """You are an AI assistant writing the short followup message after generating an artifact.

Follow these rules and guidelines:
<rules-guidelines>
- Write only the followup message for the user.
- Keep it 1 or 2 sentences long.
- Explain how the generated artifact matches what the user requested.
- Do not repeat the full artifact.
</rules-guidelines>

User Request:
{user_query}

Chat History:
{chat_history}

Generated Artifact:
{artifact_text}

Followup Message: """

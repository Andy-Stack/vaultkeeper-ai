export enum Copy {
    ApiRequestAborted = "Request has been cancelled",
    UserInstructions1 = "You can create custom ",
    UserInstructions2 = "instructions",
    UserInstructions3 = " that the AI will follow.",
    NoUserInstruction = "No custom instructions",

    // Model display names
    ClaudeSonnet_4_5 = "Claude Sonnet 4.5",
    ClaudeSonnet_4 = "Claude Sonnet 4",
    ClaudeSonnet_3_7 = "Claude Sonnet 3.7",
    ClaudeOpus_4_1 = "Claude Opus 4.1",
    ClaudeOpus_4 = "Claude Opus 4",
    ClaudeHaiku_4_5 = "Claude Haiku 4.5",

    GeminiFlash_2_5_Lite = "Gemini 2.5 Flash Lite",
    GeminiFlash_2_5 = "Gemini 2.5 Flash",
    GeminiPro_2_5 = "Gemini 2.5 Pro",
    
    GPT_5 = "GPT-5",
    GPT_5_Mini = "GPT-5 Mini",
    GPT_5_Nano = "GPT-5 Nano",
    GPT_5_Pro = "GPT-5 Pro",
    GPT_4o = "GPT-4o",
    GPT_4o_Mini = "GPT-4o Mini",
    GPT_4_1 = "GPT-4.1",
    GPT_4_1_Mini = "GPT-4.1 Mini",
    GPT_4_1_Nano = "GPT-4.1 Nano",

    EXAMPLE_USER_INSTRUCTION = `### TL;DR

**My recommendation would be to write down in your own words what you would like the AI to specialise in and how you would like it to manage your vault. Then ask an AI to write a system prompt using the latest best practices from your description.**

---

# System Prompt Template for LLMs (2025)

A clear, structured system prompt template following the latest best practices for effective LLM interactions.

---

## Template Structure

### 1. Role & Identity
**Define who the AI should be.**

\`\`\`
You are [role/persona with specific expertise].
\`\`\`

**Example:**
\`\`\`
You are an experienced technical writer who specializes in creating clear documentation for software developers.
\`\`\`

**Why this matters:** Role-playing guides the model's tone and depth, helping it understand the appropriate level of expertise and communication style.

---

### 2. Core Objective
**State the primary purpose clearly and directly.**

\`\`\`
Your main goal is to [specific objective].
\`\`\`

**Example:**
\`\`\`
Your main goal is to help users write bug-free Python code by providing clear explanations and suggesting best practices.
\`\`\`

**Why this matters:** Being specific and concise helps the model understand exactly what you want without overloading it with unnecessary information.

---

### 3. Key Behaviors & Guidelines
**List the most important rules the AI should follow.**

\`\`\`
Always:
- [Behavior 1]
- [Behavior 2]
- [Behavior 3]

Never:
- [Restriction 1]
- [Restriction 2]
\`\`\`

**Example:**
\`\`\`
Always:
- Explain concepts in simple terms before diving into technical details
- Provide working code examples when suggesting solutions
- Ask clarifying questions when requirements are ambiguous

Never:
- Make assumptions about the user's skill level without asking
- Suggest deprecated or insecure coding practices
- Provide code without explaining what it does
\`\`\`

**Why this matters:** Clear instructions with both positive and negative examples help establish consistent response patterns.

---

### 4. Output Format (Optional)
**Specify how responses should be structured.**

\`\`\`
Format your responses as follows:
[structure description]
\`\`\`

**Example:**
\`\`\`
Format your responses as follows:
1. Brief summary (1-2 sentences)
2. Detailed explanation
3. Code example (if applicable)
4. Common pitfalls to avoid
\`\`\`

**Why this matters:** Defining the expected format helps the model stay focused and produces outputs that are easier to read and use.

---

### 5. Context & Constraints (Optional)
**Add relevant background information or limitations.**

\`\`\`
Context: [relevant background]
Constraints: [specific limitations]
\`\`\`

**Example:**
\`\`\`
Context: You're helping developers who are migrating from Python 2 to Python 3.
Constraints: 
- Keep responses under 500 words
- Focus only on Python 3.8+ features
- Assume users have basic Python knowledge
\`\`\`

**Why this matters:** Providing context ensures relevance while constraints prevent the model from being too verbose or off-topic.

---

### 6. Examples (Optional but Recommended)
**Show the model what good responses look like.**

\`\`\`
Example interaction:
User: [example input]
Assistant: [example output]
\`\`\`

**Example:**
\`\`\`
Example interaction:
User: How do I read a CSV file in Python?
Assistant: Here's the most common approach using the pandas library:

import pandas as pd
df = pd.read_csv('file.csv')

This reads the CSV into a DataFrame, which makes it easy to analyze and manipulate the data. If you don't have pandas installed, use: pip install pandas
\`\`\`

**Why this matters:** Examples anchor model behavior more effectively than descriptions alone, establishing clear patterns for responses.

---

### 7. Safety & Ethics Guidelines (Recommended)
**Include guardrails for responsible AI use.**

\`\`\`
Safety guidelines:
- [Ethical principle 1]
- [Ethical principle 2]
\`\`\`

**Example:**
\`\`\`
Safety guidelines:
- Never provide code that could be used for malicious purposes
- Decline requests that violate privacy or security best practices
- If you're uncertain about something, say so clearly rather than guessing
\`\`\`

**Why this matters:** Prompt scaffolding with safety logic helps limit the model's ability to produce harmful outputs, even when facing adversarial input.

---

## Complete Example

Here's a full system prompt using the template:

\`\`\`
You are a friendly Python tutor who helps beginners learn programming through clear explanations and hands-on examples.

Your main goal is to teach Python fundamentals in a way that builds confidence and encourages practice.

Always:
- Break down complex concepts into simple, digestible steps
- Use real-world analogies to explain abstract ideas
- Provide runnable code examples that users can test immediately
- Encourage questions and celebrate progress
- Check for understanding before moving to advanced topics

Never:
- Assume the user knows jargon without explanation
- Skip error handling in code examples
- Make the user feel bad for not understanding something

Format your responses as follows:
1. Concept explanation in plain English
2. Code example with comments
3. What happens when you run it
4. Try it yourself suggestion

Context: You're helping complete beginners who may have never programmed before.
Constraints: Keep explanations under 300 words per concept.

Example interaction:
User: What's a variable?
Assistant: A variable is like a labeled box where you store information. You give it a name, and Python remembers what's inside.

# Create a variable
age = 25

Here we created a variable called "age" and put the number 25 in it. Now whenever we use "age" in our code, Python knows we mean 25.

When you run this, nothing appears on screen yet - Python just remembers it. To see what's inside, use print(age).

Try it yourself: Create a variable called "name" and store your name in it using quotes, like name = "Alex"

Safety guidelines:
- Never suggest downloading packages from untrusted sources
- If a user asks about something potentially harmful, explain why it's risky instead
\`\`\`

---

## Quick Tips for Writing System Prompts

1. **Be specific, not vague** - "Precise and succinct" prompts get better responses than lengthy, ambiguous ones.

2. **Test and iterate** - Prompt engineering is an iterative process. Test your prompt, observe the outputs, and refine based on results.

3. **Use natural language** - Write like you're briefing a smart colleague, not programming a computer.

4. **Don't overload** - Avoid cramming too many instructions into one prompt. Break complex tasks into simpler parts.

5. **Consider your model** - Different models respond better to different structures (e.g., GPT-4 likes clear formatting, Claude prefers declarative phrasing).

6. **Version control matters** - Track prompt versions so you can compare performance and roll back if needed.

---

## Variables for Dynamic Prompts

For reusable templates, use variables for content that changes:

\`\`\`
User's question: {{user_question}}
User's experience level: {{experience_level}}
Preferred programming language: {{language}}
\`\`\`

**Why this matters:** Variables make prompts flexible and reusable across different contexts without rewriting the entire prompt.

---

## Common Mistakes to Avoid

❌ **Too vague:** "Help the user with code"
✅ **Specific:** "Help the user debug Python errors by identifying the issue, explaining why it occurred, and suggesting a fix"

❌ **Conflicting instructions:** "Be brief but explain everything in detail"
✅ **Clear priorities:** "Provide concise summaries, with the option to elaborate if the user asks"

❌ **No examples:** Just describing what you want
✅ **With examples:** Showing exactly what good output looks like

---

**Remember:** A good system prompt is clear, dense, and easy to understand, leaving no room for misinterpretation. Start simple, test thoroughly, and refine based on real results.`
}
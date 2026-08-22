async function run() {
  const c = (await fetch('http://localhost:3000/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then((r) => r.json())) as { id: string };
  console.log('Created conversation:', c.id);

  // Turn 1: I'm bored
  const t1 = (await fetch(`http://localhost:3000/api/conversations/${c.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: "I'm bored" }),
  }).then((r) => r.json())) as { assistantMessage?: { content?: string } };
  console.log('\n[Turn 1] User: "I\'m bored"');
  console.log('Haven:', t1.assistantMessage?.content);

  // Turn 2: yes reading a book
  const t2 = (await fetch(`http://localhost:3000/api/conversations/${c.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'yes reading a book' }),
  }).then((r) => r.json())) as { assistantMessage?: { content?: string } };
  console.log('\n[Turn 2] User: "yes reading a book"');
  console.log('Haven:', t2.assistantMessage?.content);

  // Turn 3: Forget books. Tell me something interesting.
  const t3 = (await fetch(`http://localhost:3000/api/conversations/${c.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Forget books. Tell me something interesting.' }),
  }).then((r) => r.json())) as { assistantMessage?: { content?: string } };
  console.log('\n[Turn 3] User: "Forget books. Tell me something interesting."');
  console.log('Haven:', t3.assistantMessage?.content);

  // Turn 4: I just want someone to sit with me.
  const t4 = (await fetch(`http://localhost:3000/api/conversations/${c.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'I just want someone to sit with me.' }),
  }).then((r) => r.json())) as { assistantMessage?: { content?: string } };
  console.log('\n[Turn 4] User: "I just want someone to sit with me."');
  console.log('Haven:', t4.assistantMessage?.content);
}

run().catch(console.error);

export {};

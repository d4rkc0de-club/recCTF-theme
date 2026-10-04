/**
 * data.js — CTFd-compatible Mock Data Layer for recCTF Challenges
 * 
 * ROLE:
 * Provides static fixture data and asynchronous methods mirroring CTFd's
 * REST API (/api/v1/challenges, /api/v1/challenges/<id>, etc.).
 * 
 * SWAPPING FOR REAL BACKEND:
 * To connect to a live CTFd instance, replace the body of each exported function
 * with real `fetch('/api/v1/...')` calls sending appropriate headers (e.g. CSRF-Token).
 * The function signatures and returned Promise shapes match CTFd API standard JSON.
 */

const NOW = Date.now();
const ago = (mins) => new Date(NOW - mins * 60_000).toISOString();

const TEAMS = [
  'Future Gadget Lab',
  'SERN Intern Pool',
  'Rounder Taskforce',
  'Valkyrie Resistance',
  'IBN-5100 Seekers',
  'Akihabara Radiance',
  'Daru the Super Hacka',
  'Lab Member 004',
  'Okabe Rintaro (Kyouma)',
  'Makise Kurisu'
];

let rngSeed = 1048596;
function pseudoRandom() {
  rngSeed = (rngSeed * 16807) % 2147483647;
  return rngSeed / 2147483647;
}

function generateSolves(count, includesUser = false) {
  const solves = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const team = TEAMS[i % TEAMS.length];
    solves.push({
      account_id: 100 + i,
      name: team,
      date: ago(Math.round(25 + i * 42 + pseudoRandom() * 30))
    });
  }
  if (includesUser) {
    solves.push({
      account_id: 1,
      name: 'You (Lab Member 001)',
      date: ago(8)
    });
  }
  return solves.sort((a, b) => a.date.localeCompare(b.date));
}

// 18 Challenges across 5 categories (Web, Crypto, Pwn, Forensics, Reverse)
const CHALLENGES_DATABASE = [
  // --- Category 1: Web ---
  {
    id: 1,
    name: 'SERN Employee Portal',
    category: 'Web',
    value: 100,
    byline: 'Daru the Super Hacka',
    tags: [{ value: 'web' }, { value: 'beginner' }],
    description: '<p>A careless SERN intern left the internal employee login portal publicly indexable. Can you locate the test credentials left behind in the developer remarks?</p>',
    connection_info: 'https://sern-portal.recctf.local',
    files: [],
    hints: [
      { id: 101, cost: 0, title: 'Source inspection', content: '<p>Standard HTML comments are visible without running scripts. Right-click and inspect the DOM.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{v13w_s0urc3_1s_4_d_m41l}',
    solved_by_me: true,
    solution: '<p>Inspect the login page source code. Inside the <code>&lt;form&gt;</code> element, an HTML comment reads: <code>&lt;!-- Dev note: temp test pass recCTF{v13w_s0urc3_1s_4_d_m41l} --&gt;</code>.</p>'
  },
  {
    id: 2,
    name: 'D-Mail Relay',
    category: 'Web',
    value: 250,
    byline: 'Okabe Rintaro',
    tags: [{ value: 'web' }, { value: 'ssrf' }, { value: 'medium' }],
    description: '<p>The laboratory microwave relay interface accepts webhook URLs for remote message forwarding. However, administrative commands are strictly restricted to requests originating from <code>127.0.0.1:1048</code>.</p>',
    connection_info: 'https://dmail.recctf.local',
    files: [],
    hints: [
      { id: 102, cost: 50, title: 'Internal host bypass', content: '<p>Try utilizing alternative localhost representations or URL redirect headers (e.g. <code>http://0.0.0.0:1048/admin</code> or decimal notation).</p>' }
    ],
    max_attempts: 3,
    attempts: 2,
    flag: 'recCTF{d_m41l_t0_l0c4lh0st}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 3,
    name: 'IBN Gateway Header',
    category: 'Web',
    value: 300,
    byline: 'Daru the Super Hacka',
    tags: [{ value: 'web' }, { value: 'headers' }],
    description: '<p>The legacy IBN server requires specific historical HTTP client headers before granting access to its mainframe diagnostics.</p>',
    connection_info: 'https://ibn-gateway.recctf.local',
    files: [],
    hints: [
      { id: 103, cost: 25, title: 'Client Identity', content: '<p>Check for headers such as <code>X-Terminal-Type: IBN-5100</code>.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{h34d3rs_fr0m_1975}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 4,
    name: 'Mayuri Pocket Watch Sync',
    category: 'Web',
    value: 400,
    byline: 'Mayuri Shiina',
    tags: [{ value: 'web' }, { value: 'timing' }, { value: 'hard' }],
    description: '<p>Mayuri\'s pocket watch stopped working! The timing synchronization endpoint validates HMAC signatures character-by-character using an un-padded string comparison.</p>',
    connection_info: 'https://mayuri-watch.recctf.local/api/sync',
    files: ['/files/sync_client.py'],
    hints: [],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{t1m1ng_4tt4ck_st0pp3d_cl0ck}',
    solved_by_me: false,
    solution: null
  },

  // --- Category 2: Crypto ---
  {
    id: 5,
    name: 'Divergence Cipher',
    category: 'Crypto',
    value: 100,
    byline: 'Future Gadget Lab',
    tags: [{ value: 'crypto' }, { value: 'beginner' }],
    description: '<p>An encrypted transmission was intercepted across the attractor field. A simple Caesar shift appears to have been applied:</p><pre><code>uhfFWI{fdhvdu_lv_dozdbv_vkliwb}</code></pre>',
    connection_info: null,
    files: [],
    hints: [
      { id: 201, cost: 0, title: 'Rotational shift', content: '<p>Shift each alphabetical character backwards by 3 positions (ROT-23 / reverse ROT-3).</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{caesar_is_always_shifty}',
    solved_by_me: true,
    solution: '<p>Decrypting <code>uhfFWI{fdhvdu_lv_dozdbv_vkliwb}</code> with a Caesar shift of 3 yields <code>recCTF{caesar_is_always_shifty}</code>.</p>'
  },
  {
    id: 6,
    name: 'Phone Microwave OTP',
    category: 'Crypto',
    value: 200,
    byline: 'Makise Kurisu',
    tags: [{ value: 'crypto' }, { value: 'stream' }],
    description: '<p>The experimental timer used a pseudo-random key stream that repeats every 16 bytes. Two separate messages were encrypted under the exact same one-time pad keystream.</p>',
    connection_info: null,
    files: ['/files/cipher1.bin', '/files/cipher2.bin'],
    hints: [
      { id: 202, cost: 30, title: 'Keystream reuse', content: '<p>C1 XOR C2 = P1 XOR P2. Crib drag common CTF flag prefixes across the XOR difference.</p>' }
    ],
    max_attempts: 5,
    attempts: 1,
    flag: 'recCTF{n3v3r_r3us3_k3ystr34m}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 7,
    name: 'Attractor Field RSA',
    category: 'Crypto',
    value: 350,
    byline: 'Makise Kurisu',
    tags: [{ value: 'crypto' }, { value: 'rsa' }, { value: 'math' }],
    description: '<p>Two divergent world-line communication channels generated RSA moduli <code>N1</code> and <code>N2</code> using a shared prime factor <code>p</code>.</p>',
    connection_info: null,
    files: ['/files/public_keys.json'],
    hints: [
      { id: 203, cost: 40, title: 'Common factor', content: '<p>Compute the greatest common divisor: <code>p = gcd(N1, N2)</code>.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{sh4r3d_pr1m3_d1v3rg3nc3}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 8,
    name: 'Rounder Key Exchange',
    category: 'Crypto',
    value: 450,
    byline: 'FB',
    tags: [{ value: 'crypto' }, { value: 'diffie-hellman' }, { value: 'hard' }],
    description: '<p>Rounder squad encrypted their dispatches using Diffie-Hellman, but the modulus <code>p</code> is a smooth prime vulnerable to the Pohlig-Hellman algorithm.</p>',
    connection_info: null,
    files: ['/files/dh_exchange.txt'],
    hints: [],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{p0hl1g_h3llm4n_sm00th_pr1m3}',
    solved_by_me: false,
    solution: null
  },

  // --- Category 3: Pwn ---
  {
    id: 9,
    name: 'Upa Buffer Overflow',
    category: 'Pwn',
    value: 150,
    byline: 'Mayuri Shiina',
    tags: [{ value: 'pwn' }, { value: 'bof' }, { value: 'beginner' }],
    description: '<p>Mayuri\'s Upa toy collection catalog program uses <code>gets()</code> into a 64-byte stack buffer. Smash the stack and redirect execution to the <code>win()</code> function at <code>0x401186</code>.</p>',
    connection_info: 'nc upa.recctf.local 4004',
    files: ['/files/upa_catalog', '/files/upa.c'],
    hints: [
      { id: 301, cost: 0, title: 'Offset calculation', content: '<p>The return address offset is 72 bytes (64-byte buffer + 8-byte saved RBP on x86_64).</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{tutturu_r3t2w1n_succ3ss}',
    solved_by_me: true,
    solution: '<p>Send 72 bytes of junk followed by the address <code>0x00401186</code> in little-endian format.</p>'
  },
  {
    id: 10,
    name: 'Lab Memory Leak',
    category: 'Pwn',
    value: 300,
    byline: 'Daru the Super Hacka',
    tags: [{ value: 'pwn' }, { value: 'format-string' }],
    description: '<p>The lab\'s gadget status monitor passes your input directly into <code>printf(user_input)</code> without a format specifier.</p>',
    connection_info: 'nc monitor.recctf.local 5005',
    files: ['/files/gadget_monitor'],
    hints: [
      { id: 302, cost: 35, title: 'Stack leak', content: '<p>Use <code>%p.%p.%p</code> or positional arguments like <code>%7$s</code> to read pointers directly off the stack.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{fmt_str_st4ck_l34k}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 11,
    name: 'Time Leap Hijack',
    category: 'Pwn',
    value: 500,
    byline: 'Makise Kurisu',
    tags: [{ value: 'pwn' }, { value: 'rop' }, { value: 'hard' }],
    description: '<p>The memory digitizer has ASLR and NX enabled with no PIE. Construct a Return-Oriented Programming (ROP) chain to leak libc via <code>puts(puts@got)</code> and trigger <code>system("/bin/sh")</code>.</p>',
    connection_info: 'nc digitizer.recctf.local 6006',
    files: ['/files/digitizer', '/files/libc.so.6'],
    hints: [],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{r0p_ch41n_t1m3_tr4v3l}',
    solved_by_me: false,
    solution: null
  },

  // --- Category 4: Forensics ---
  {
    id: 12,
    name: 'Gel-Banana EXIF',
    category: 'Forensics',
    value: 100,
    byline: 'Future Gadget Lab',
    tags: [{ value: 'forensics' }, { value: 'metadata' }, { value: 'beginner' }],
    description: '<p>An image of the anomalous gelatinized banana was captured with a digital camera. Examination of the embedded metadata reveals an operator log tag.</p>',
    connection_info: null,
    files: ['/files/gel_banana.jpg'],
    hints: [
      { id: 401, cost: 0, title: 'Exif inspection', content: '<p>Use <code>exiftool gel_banana.jpg</code> or inspect the ImageDescription field.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{m3t4d4t4_g3l_b4n4n4}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 13,
    name: 'Microwave Transmission PCAP',
    category: 'Forensics',
    value: 250,
    byline: 'Daru the Super Hacka',
    tags: [{ value: 'forensics' }, { value: 'network' }, { value: 'pcap' }],
    description: '<p>We captured Wi-Fi traffic while the Phone Microwave (name subject to change) was running in time-displacement mode. Reconstruct the transferred stream file.</p>',
    connection_info: null,
    files: ['/files/microwave_traffic.pcapng'],
    hints: [
      { id: 402, cost: 20, title: 'Stream export', content: '<p>Open in Wireshark and go to File -> Export Objects -> HTTP.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{pcap_str34m_3xp0rt}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 14,
    name: 'Suzuha Time Machine Disk',
    category: 'Forensics',
    value: 350,
    byline: 'Suzuha Amane',
    tags: [{ value: 'forensics' }, { value: 'disk' }, { value: 'filesystem' }],
    description: '<p>The FG-204 time machine\'s onboard flash memory sustained partition damage upon landing in Akihabara. Carve out the deleted mission manifest file.</p>',
    connection_info: null,
    files: ['/files/fg204_disk.raw.gz'],
    hints: [
      { id: 403, cost: 40, title: 'File carving', content: '<p>Utilize <code>testdisk</code> or <code>foremost</code> to recover deleted inodes.</p>' }
    ],
    max_attempts: 4,
    attempts: 1,
    flag: 'recCTF{f1l3_c4rv1ng_fg204}',
    solved_by_me: false,
    solution: null
  },

  // --- Category 5: Reverse ---
  {
    id: 15,
    name: 'IBN 5100 Bootloader',
    category: 'Reverse',
    value: 150,
    byline: 'John Titor',
    tags: [{ value: 'reverse' }, { value: 'retro' }, { value: 'x86' }],
    description: '<p>The IBN 5100 emulator requires a 16-character master unlock phrase to activate its proprietary APL/BASIC microcode engine.</p>',
    connection_info: null,
    files: ['/files/ibn5100_boot.rom'],
    hints: [
      { id: 501, cost: 0, title: 'Static strings', content: '<p>Run <code>strings</code> or load into Ghidra/IDA to trace the comparison routine.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{l3g4cy_c0d3_n3v3r_d13s}',
    solved_by_me: false,
    solution: '<p>Decompiling <code>validate_key()</code> shows character-by-character validation against the ASCII array <code>recCTF{l3g4cy_c0d3_n3v3r_d13s}</code>.</p>'
  },
  {
    id: 16,
    name: 'Phonewave Firmware v0.9',
    category: 'Reverse',
    value: 300,
    byline: 'Okabe Rintaro',
    tags: [{ value: 'reverse' }, { value: 'firmware' }, { value: 'arm' }],
    description: '<p>We pulled the ARM Cortex-M firmware from the Phone Microwave\'s timer board. Trace the ring-buffer parser that calculates the timer multiplier constant.</p>',
    connection_info: null,
    files: ['/files/phonewave_fw.elf'],
    hints: [],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{4rm_f1rmw4r3_r3v3rs3d}',
    solved_by_me: false,
    solution: null
  },
  {
    id: 17,
    name: 'Amadeus Neural Core',
    category: 'Reverse',
    value: 450,
    byline: 'Alexis Leskinen',
    tags: [{ value: 'reverse' }, { value: 'ai' }, { value: 'obfuscation' }],
    description: '<p>The Amadeus system stores memory access tokens inside an obfuscated virtual machine bytecode dispatcher.</p>',
    connection_info: null,
    files: ['/files/amadeus_core.bin'],
    hints: [
      { id: 502, cost: 50, title: 'Custom VM', content: '<p>Identify the opcode fetch-decode-execute loop and map out the 8 virtual instructions.</p>' }
    ],
    max_attempts: 0,
    attempts: 0,
    flag: 'recCTF{vm_d1sp4tch_4m4d3us}',
    solved_by_me: false,
    solution: null
  }
];

// Prepopulate solves for each challenge
CHALLENGES_DATABASE.forEach((c) => {
  const count = Math.floor(pseudoRandom() * 12) + 2;
  c.solves = generateSolves(count, c.solved_by_me);
});

// Mock submission records for testing the Submissions tab
const SUBMISSIONS_DATABASE = {
  1: [
    { provided: 'recCTF{admin_login_pass}', type: 'incorrect', date: ago(45) },
    { provided: 'recCTF{v13w_s0urc3_1s_4_d_m41l}', type: 'correct', date: ago(8) }
  ],
  2: [
    { provided: 'recCTF{localhost_wrong}', type: 'incorrect', date: ago(30) },
    { provided: 'recCTF{ssrf_attempt_fail}', type: 'incorrect', date: ago(15) }
  ],
  5: [
    { provided: 'recCTF{caesar_is_always_shifty}', type: 'correct', date: ago(60) }
  ],
  9: [
    { provided: 'recCTF{bof_test_123}', type: 'incorrect', date: ago(90) },
    { provided: 'recCTF{tutturu_r3t2w1n_succ3ss}', type: 'correct', date: ago(50) }
  ]
};

/* =========================================================================
   PUBLIC API METHODS
   Matches CTFd /api/v1 response format { success: true, data: ... }
   ========================================================================= */

/**
 * Fetch the list of challenges (metadata used to render the challenge board).
 * In CTFd: GET /api/v1/challenges
 */
async function getChallenges() {
  await new Promise((resolve) => setTimeout(resolve, 350)); // Simulated network latency
  return {
    success: true,
    data: CHALLENGES_DATABASE.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      value: c.value,
      tags: c.tags,
      solved_by_me: c.solved_by_me
    }))
  };
}

/**
 * Fetch detailed challenge specification by ID.
 * In CTFd: GET /api/v1/challenges/<id>
 */
async function getChallenge(id) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const chal = CHALLENGES_DATABASE.find((c) => c.id === id);
  if (!chal) {
    throw new Error(`Challenge ${id} not found`);
  }
  // Exclude raw flag; include sanitized fields matching CTFd response
  const { flag, solves, ...publicData } = chal;
  return {
    success: true,
    data: publicData
  };
}

/**
 * Submit a flag attempt.
 * In CTFd: POST /api/v1/challenges/attempt
 */
async function submitFlag(id, flagInput) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const chal = CHALLENGES_DATABASE.find((c) => c.id === id);
  if (!chal) {
    return { success: false, data: { status: 'error', message: 'Challenge does not exist.' } };
  }

  if (chal.solved_by_me) {
    return {
      success: true,
      data: {
        status: 'already_solved',
        message: 'You have already solved this challenge.'
      }
    };
  }

  if (chal.max_attempts > 0 && chal.attempts >= chal.max_attempts) {
    return {
      success: true,
      data: {
        status: 'paused',
        message: 'Maximum submission attempts reached for this challenge.'
      }
    };
  }

  chal.attempts++;

  // Record submission
  if (!SUBMISSIONS_DATABASE[id]) SUBMISSIONS_DATABASE[id] = [];
  const normalizedInput = flagInput.trim();
  const isCorrect = normalizedInput === chal.flag;

  SUBMISSIONS_DATABASE[id].unshift({
    provided: normalizedInput,
    type: isCorrect ? 'correct' : 'incorrect',
    date: new Date().toISOString()
  });

  if (isCorrect) {
    chal.solved_by_me = true;
    chal.solves.push({
      account_id: 1,
      name: 'You (Lab Member 001)',
      date: new Date().toISOString()
    });
    return {
      success: true,
      data: {
        status: 'correct',
        message: 'Correct! The divergence value has shifted.'
      }
    };
  }

  return {
    success: true,
    data: {
      status: 'incorrect',
      message: 'Incorrect flag. The world line remains unchanged.'
    }
  };
}

/**
 * Fetch solves list for a challenge.
 * In CTFd: GET /api/v1/challenges/<id>/solves
 */
async function getSolves(id) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const chal = CHALLENGES_DATABASE.find((c) => c.id === id);
  return {
    success: true,
    data: chal ? chal.solves : []
  };
}

/**
 * Fetch previous submissions made by the user for this challenge.
 * In CTFd: GET /api/v1/challenges/<id>/submissions
 */
async function getSubmissions(id) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const list = SUBMISSIONS_DATABASE[id] || [];
  return {
    success: true,
    data: list
  };
}

/**
 * Unlock a locked hint.
 * In CTFd: POST /api/v1/hints/<id>
 */
async function unlockHint(hintId) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  for (const chal of CHALLENGES_DATABASE) {
    const hint = (chal.hints || []).find((h) => h.id === hintId);
    if (hint) {
      if (!hint.content) {
        hint.content = `<p>Decrypted Hint: Focus on parameter validation and examine historical RFC specifications.</p>`;
      }
      return {
        success: true,
        data: {
          id: hint.id,
          content: hint.content
        }
      };
    }
  }
  return {
    success: false,
    message: 'Hint not found'
  };
}

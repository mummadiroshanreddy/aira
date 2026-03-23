<?php
// ════════════════════════════════════════════════════════
// ARIA PRODUCTION PROXY (Hostinger) — DUAL PROVIDER
// ════════════════════════════════════════════════════════
require_once '.env.php';

$allowed_origin = defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : 'http://localhost:3000';
header("Access-Control-Allow-Origin: " . $allowed_origin);
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (strpos($_SERVER['REQUEST_URI'], '/providers') !== false || strpos($_SERVER['REQUEST_URI'], '/health') !== false) {
        $hasGroq = defined('GROQ_API_KEY') && !empty(GROQ_API_KEY) && GROQ_API_KEY !== 'your_groq_api_key_here';
        $hasGemini = defined('GEMINI_API_KEY') && !empty(GEMINI_API_KEY) && GEMINI_API_KEY !== 'your_gemini_api_key_here';
        
        $providers = [];
        if ($hasGroq)   $providers[] = ['id' => 'groq', 'name' => 'Groq', 'model' => 'llama-3.3-70b-versatile', 'speed' => 'Fastest', 'badge' => '⚡'];
        if ($hasGemini) $providers[] = ['id' => 'gemini', 'name' => 'Gemini', 'model' => 'gemini-2.0-flash', 'speed' => 'Fast', 'badge' => '✨'];
        
        echo json_encode(['available' => $providers, 'default' => $hasGroq ? 'groq' : 'gemini']);
        exit;
    }
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST for chat.']);
    exit;
}

// Very basic IP-based rate limiting via tmp directory for Hostinger
function checkRateLimit() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $tmpDir = sys_get_temp_dir() . '/aria_rate_limits';
    if (!is_dir($tmpDir)) @mkdir($tmpDir, 0777, true);
    
    $limit = defined('RATE_LIMIT_MAX') ? RATE_LIMIT_MAX : 100;
    $window = defined('RATE_LIMIT_WINDOW') ? RATE_LIMIT_WINDOW : 3600;
    
    $file = $tmpDir . '/rl_' . md5($ip) . '.json';
    $now = time();
    $data = ['count' => 0, 'startTime' => $now];
    
    if (file_exists($file)) {
        $json = @file_get_contents($file);
        if ($json) {
            $parsed = json_decode($json, true);
            if ($now - $parsed['startTime'] < $window) {
                $data = $parsed;
            }
        }
    }
    
    $data['count']++;
    @file_put_contents($file, json_encode($data));
    
    if ($data['count'] > $limit) {
        http_response_code(429);
        echo json_encode(['error' => 'Rate limit exceeded.', 'code' => 'RATE_LIMITED']);
        exit;
    }
}
checkRateLimit();

$input = file_get_contents('php://input');
$body = json_decode($input, true);

if (!$body || empty($body['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload. "messages" array required.']);
    exit;
}

$isStream = $body['stream'] ?? false;
$provider = $body['provider'] ?? 'groq';

$hasGroq = defined('GROQ_API_KEY') && !empty(GROQ_API_KEY) && GROQ_API_KEY !== 'your_groq_api_key_here';
$hasGemini = defined('GEMINI_API_KEY') && !empty(GEMINI_API_KEY) && GEMINI_API_KEY !== 'your_gemini_api_key_here';

$activeProvider = ($provider === 'groq' && $hasGroq) ? 'groq' : (($provider === 'gemini' && $hasGemini) ? 'gemini' : ($hasGroq ? 'groq' : 'gemini'));

if ($isStream) {
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    
    // Announce provider
    echo "data: " . json_encode(['type' => 'provider_info', 'provider' => $activeProvider]) . "\n\n";
    ob_flush(); flush();
}

$systemPrompt = $body['system'] ?? '';
$messages = $body['messages'];
$maxTokens = $body['max_tokens'] ?? 1200;

function executeGroq($messages, $systemPrompt, $maxTokens, $isStream) {
    $apiKey = GROQ_API_KEY;
    $url = "https://api.groq.com/openai/v1/chat/completions";
    
    $payloadMsgs = [];
    if (!empty($systemPrompt)) {
        $payloadMsgs[] = ['role' => 'system', 'content' => $systemPrompt];
    }
    foreach (array_slice($messages, -12) as $msg) {
        $payloadMsgs[] = ['role' => $msg['role'], 'content' => $msg['content']];
    }
    
    $payload = [
        'model' => 'llama-3.3-70b-versatile',
        'messages' => $payloadMsgs,
        'max_tokens' => (int)$maxTokens,
        'temperature' => 0.7,
        'stream' => $isStream
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$apiKey}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    if ($isStream) {
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
            $lines = explode("\n", $data);
            foreach ($lines as $line) {
                if (strpos($line, 'data: ') === 0) {
                    $jsonStr = substr($line, 6);
                    if (trim($jsonStr) === '[DONE]') {
                        echo "data: " . json_encode(['type' => 'message_stop']) . "\n\n";
                        ob_flush(); flush();
                        continue;
                    }
                    $parsed = json_decode($jsonStr, true);
                    if (isset($parsed['choices'][0]['delta']['content'])) {
                        $text = $parsed['choices'][0]['delta']['content'];
                        if ($text !== '') {
                            echo "data: " . json_encode(['type' => 'content_block_delta', 'delta' => ['type' => 'text_delta', 'text' => $text]]) . "\n\n";
                            ob_flush(); flush();
                        }
                    }
                }
            }
            return strlen($data);
        });
        curl_exec($ch);
        curl_close($ch);
    } else {
        $response = curl_exec($ch);
        curl_close($ch);
        $decoded = json_decode($response, true);
        echo json_encode(['content' => [['type' => 'text', 'text' => $decoded['choices'][0]['message']['content'] ?? '']]]);
    }
}

function executeGemini($messages, $systemPrompt, $maxTokens, $isStream) {
    $apiKey = GEMINI_API_KEY;
    $url = $isStream 
        ? "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key={$apiKey}"
        : "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={$apiKey}";
        
    $geminiMessages = [];
    $historyCount = count($messages);
    for ($i = 0; $i < $historyCount - 1; $i++) {
        $msg = $messages[$i];
        $geminiMessages[] = [
            'role' => ($msg['role'] === 'assistant') ? 'model' : 'user',
            'parts' => [['text' => $msg['content']]]
        ];
    }
    $lastMessage = $messages[$historyCount - 1];
    $geminiMessages[] = ['role' => 'user', 'parts' => [['text' => $lastMessage['content']]]];

    $payload = [
        'contents' => $geminiMessages,
        'generationConfig' => [
            'maxOutputTokens' => (int)$maxTokens,
            'temperature' => 0.7
        ]
    ];
    if (!empty($systemPrompt)) {
        $payload['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    if ($isStream) {
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
            $lines = explode("\n", $data);
            foreach ($lines as $line) {
                if (strpos($line, 'data: ') === 0) {
                    $jsonStr = substr($line, 6);
                    $parsed = json_decode($jsonStr, true);
                    if (isset($parsed['error'])) {
                        echo "data: " . json_encode(['type' => 'error', 'error' => $parsed['error']['message']]) . "\n\n";
                        ob_flush(); flush();
                        continue;
                    }
                    if ($parsed && isset($parsed['candidates'][0]['content']['parts'][0]['text'])) {
                        $text = $parsed['candidates'][0]['content']['parts'][0]['text'];
                        if ($text !== '') {
                            echo "data: " . json_encode(['type' => 'content_block_delta', 'delta' => ['type' => 'text_delta', 'text' => $text]]) . "\n\n";
                            ob_flush(); flush();
                        }
                    }
                }
            }
            return strlen($data);
        });
        curl_exec($ch);
        curl_close($ch);
        echo "data: " . json_encode(['type' => 'message_stop']) . "\n\n";
    } else {
        $response = curl_exec($ch);
        curl_close($ch);
        $decoded = json_decode($response, true);
        $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
        echo json_encode(['content' => [['type' => 'text', 'text' => $text]]]);
    }
}

try {
    if ($activeProvider === 'groq') {
        executeGroq($messages, $systemPrompt, $maxTokens, $isStream);
    } else {
        executeGemini($messages, $systemPrompt, $maxTokens, $isStream);
    }
} catch (Exception $e) {
    if ($isStream) {
        echo "data: " . json_encode(['type' => 'error', 'error' => $e->getMessage()]) . "\n\n";
    } else {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>

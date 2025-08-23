const WebSocket = require('ws');
require('dotenv').config();

async function testOpenAIRealtimeAPI() {
    console.log('Testing OpenAI Realtime API with direct API key...');
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('OPENAI_API_KEY not found in environment variables');
        return;
    }

    // OpenAI Realtime API WebSocket endpoint
    const wsUrl = 'wss://api.openai.com/v1/realtime';
    const model = 'gpt-4o-realtime-preview-2024-12-17';
    const url = `${wsUrl}?model=${model}`;
    
    console.log('Connecting to:', wsUrl);
    console.log('Using API key:', apiKey.substring(0, 10) + '...');
    console.log('Model:', model);

    try {
        const ws = new WebSocket(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });

        ws.on('open', () => {
            console.log('✅ Connected to OpenAI Realtime API successfully!');
            
            // Send session update
            const sessionUpdate = {
                event_id: 'event_001',
                type: 'session.update',
                session: {
                    modalities: ['text'],
                    instructions: 'You are a helpful assistant for testing API connectivity.',
                    voice: 'alloy',
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    temperature: 0.8
                }
            };
            
            console.log('Sending session update...');
            ws.send(JSON.stringify(sessionUpdate));
        });

        ws.on('message', (data) => {
            const event = JSON.parse(data.toString());
            console.log('📥 Received event:', JSON.stringify(event, null, 2));
            
            // If session is created, send a test message
            if (event.type === 'session.created' || event.type === 'session.updated') {
                console.log('Session ready! Sending test message...');
                
                const createItem = {
                    event_id: 'event_002',
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'user',
                        content: [{
                            type: 'input_text',
                            text: 'Hello! Can you confirm this connection is working?'
                        }]
                    }
                };
                
                const createResponse = {
                    event_id: 'event_003',
                    type: 'response.create',
                    response: {
                        modalities: ['text']
                    }
                };
                
                ws.send(JSON.stringify(createItem));
                setTimeout(() => {
                    ws.send(JSON.stringify(createResponse));
                }, 100);
            }
            
            // Close after receiving response
            if (event.type === 'response.done') {
                console.log('✅ Test completed successfully!');
                setTimeout(() => ws.close(), 1000);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            if (error.message.includes('401')) {
                console.error('Authentication failed - API key may be invalid or insufficient permissions');
            } else if (error.message.includes('403')) {
                console.error('Access forbidden - may need ephemeral token for realtime API');
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`🔌 Connection closed: ${code} ${reason}`);
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log('⏰ Test timeout - closing connection');
                ws.close();
            }
        }, 15000);

    } catch (error) {
        console.error('❌ Failed to connect:', error.message);
    }
}

// Run the test
testOpenAIRealtimeAPI().catch(console.error);
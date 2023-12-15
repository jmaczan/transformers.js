

import { AutoTokenizer } from '../src/transformers.js';
import { getFile } from '../src/utils/hub.js';
import { m, MAX_TEST_EXECUTION_TIME } from './init.js';
import { compare } from './test_utils.js';

// Load test data generated by the python tests
// TODO do this dynamically?
const { tokenization, templates } = await (await getFile('./tests/data/tokenizer_tests.json')).json()

describe('Tokenizers', () => {

    for (let [tokenizerName, tests] of Object.entries(tokenization)) {

        it(tokenizerName, async () => {
            let tokenizer = await AutoTokenizer.from_pretrained(m(tokenizerName));

            for (let test of tests) {

                // Test encoding
                let encoded = tokenizer(test.input, {
                    return_tensor: false
                });

                // Add the input text to the encoded object for easier debugging
                encoded.input = test.input;
                test.encoded.input = test.input;

                expect(encoded).toEqual(test.encoded);

                // Test decoding
                let decoded_with_special = tokenizer.decode(encoded.input_ids, { skip_special_tokens: false });
                expect(decoded_with_special).toEqual(test.decoded_with_special);

                let decoded_without_special = tokenizer.decode(encoded.input_ids, { skip_special_tokens: true });
                expect(decoded_without_special).toEqual(test.decoded_without_special);
            }
        }, MAX_TEST_EXECUTION_TIME);
    }
});

describe('Edge cases', () => {
    it('should not crash when encoding a very long string', async () => {
        let tokenizer = await AutoTokenizer.from_pretrained('Xenova/t5-small');

        let text = String.prototype.repeat.call('Hello world! ', 50000);
        let encoded = tokenizer(text);
        expect(encoded.input_ids.data.length).toBeGreaterThan(100000);
    }, MAX_TEST_EXECUTION_TIME);

    it('should not take too long', async () => {
        let tokenizer = await AutoTokenizer.from_pretrained('Xenova/all-MiniLM-L6-v2');

        let text = String.prototype.repeat.call('a', 50000);
        let token_ids = tokenizer.encode(text);
        compare(token_ids, [101, 100, 102])
    }, 5000); // NOTE: 5 seconds
});

describe('Chat templates', () => {
    it('should generate a chat template', async () => {
        const tokenizer = await AutoTokenizer.from_pretrained("mistralai/Mistral-7B-Instruct-v0.1");

        const chat = [
            { "role": "user", "content": "Hello, how are you?" },
            { "role": "assistant", "content": "I'm doing great. How can I help you today?" },
            { "role": "user", "content": "I'd like to show off how chat templating works!" },
        ]

        const text = await tokenizer.apply_chat_template(chat, { tokenize: false });

        expect(text).toEqual("<s>[INST] Hello, how are you? [/INST]I'm doing great. How can I help you today?</s> [INST] I'd like to show off how chat templating works! [/INST]");

        const input_ids = await tokenizer.apply_chat_template(chat, { tokenize: true, return_tensor: false });
        compare(input_ids, [1, 733, 16289, 28793, 22557, 28725, 910, 460, 368, 28804, 733, 28748, 16289, 28793, 28737, 28742, 28719, 2548, 1598, 28723, 1602, 541, 315, 1316, 368, 3154, 28804, 2, 28705, 733, 16289, 28793, 315, 28742, 28715, 737, 298, 1347, 805, 910, 10706, 5752, 1077, 3791, 28808, 733, 28748, 16289, 28793])
    });

    // Dynamically-generated tests
    for (const [tokenizerName, tests] of Object.entries(templates)) {

        it(tokenizerName, async () => {
            // NOTE: not m(...) here
            // TODO: update this?
            const tokenizer = await AutoTokenizer.from_pretrained(tokenizerName);

            for (let { messages, add_generation_prompt, tokenize, target } of tests) {

                const generated = await tokenizer.apply_chat_template(messages, {
                    tokenize,
                    add_generation_prompt,
                    return_tensor: false,
                });
                expect(generated).toEqual(target)
            }
        });
    }
});

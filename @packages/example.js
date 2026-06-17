/**
 * @file @packages/example.js
 * @description Highly complex architectural and computational tasks in pure ESNext JavaScript.
 * Shows advanced logic patterns with zero external dependencies.
 * 
 * Includes:
 * 1. Directed Acyclic Graph (DAG) Agentic Workflow Engine (Self-Correcting State Machine)
 * 2. Recursive Descent Parser, AST Evaluator & Constant-Folding AST Optimizer
 * 3. In-Memory Vector Search Engine (TF-IDF, Tokenizer, Stopwords, Stemmer, Cosine Similarity)
 * 4. High-Performance Concurrent Work Queue & Event Multiplexer with Circuit Breakers
 */

// ============================================================================
// TASK 1: DIRECTED ACYCLIC GRAPH (DAG) AGENTIC WORKFLOW ENGINE
// ============================================================================
/**
 * A highly resilient multi-agent execution orchestrator.
 * Features state tracking, contextual sliding memory, dynamic task routing, 
 * and self-healing/retry mechanism upon failure.
 */
class AgentWorkflowEngine {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.globalContext = {};
    }

    /**
     * Registers an agent node in the DAG workflow.
     * @param {string} name - Unique identifier of the node.
     * @param {Function} task - Async function executing the node's agent logic.
     * @param {number} maxRetries - Maximum retry attempts before bubbling up failure.
     */
    registerNode(name, task, maxRetries = 3) {
        this.nodes.set(name, { task, maxRetries });
        if (!this.edges.has(name)) {
            this.edges.set(name, []);
        }
    }

    /**
     * Registers a transition edge between nodes with an optional routing condition.
     * @param {string} fromNode 
     * @param {string} toNode 
     * @param {Function} [condition] - Logical predicate deciding whether to traverse this edge.
     */
    addEdge(fromNode, toNode, condition = () => true) {
        if (!this.edges.has(fromNode)) {
            this.edges.set(fromNode, []);
        }
        this.edges.get(fromNode).push({ toNode, condition });
    }

    /**
     * Executes the workflow starting at a designated node.
     * Includes a self-correcting feedback loop on tool/execution failures.
     */
    async execute(startNode, inputContext = {}) {
        this.globalContext = { ...inputContext, executionHistory: [], errors: [] };
        let currentNode = startNode;

        console.log(`\n🤖 Starting Agentic DAG Workflow at [${currentNode}]...`);

        while (currentNode) {
            const nodeDef = this.nodes.get(currentNode);
            if (!nodeDef) {
                throw new Error(`Node [${currentNode}] is not registered in the workflow.`);
            }

            let attempts = 0;
            let success = false;
            let output = null;

            while (attempts < nodeDef.maxRetries && !success) {
                attempts++;
                try {
                    console.log(`   👉 Executing node [${currentNode}] (Attempt ${attempts}/${nodeDef.maxRetries})...`);
                    
                    // Injecting current error context if it's a self-healing retry
                    const inputWithContext = {
                        ...this.globalContext,
                        _retryAttempt: attempts,
                        _lastError: attempts > 1 ? this.globalContext.errors[this.globalContext.errors.length - 1] : null
                    };

                    output = await nodeDef.task(inputWithContext);
                    success = true;
                } catch (error) {
                    console.warn(`   ⚠️ Node [${currentNode}] failed: ${error.message}`);
                    this.globalContext.errors.push({
                        node: currentNode,
                        attempt: attempts,
                        message: error.message,
                        timestamp: Date.now()
                    });

                    if (attempts >= nodeDef.maxRetries) {
                        console.error(`   ❌ Node [${currentNode}] exhausted all retry attempts.`);
                        // Try to self-heal by routing to a 'Debugger' or fallback node if available
                        if (currentNode !== 'Debugger' && this.nodes.has('Debugger')) {
                            console.log(`   🔧 Routing to [Debugger] node to heal context and fix errors...`);
                            currentNode = 'Debugger';
                            success = true; // Break retry loop to traverse to Debugger
                            output = { healed: false, originalFailedNode: currentNode };
                        } else {
                            throw new Error(`Workflow execution crashed at [${currentNode}]: ${error.message}`);
                        }
                    }
                }
            }

            // Update state with execution results
            this.globalContext[currentNode] = output;
            this.globalContext.executionHistory.push({
                node: currentNode,
                timestamp: Date.now(),
                success
            });

            // Determine next node based on conditions
            const transitions = this.edges.get(currentNode) || [];
            let nextNode = null;

            for (const edge of transitions) {
                try {
                    if (await edge.condition(this.globalContext)) {
                        nextNode = edge.toNode;
                        break; // First matching path wins
                    }
                } catch (condError) {
                    console.error(`Error executing condition for edge ${currentNode} -> ${edge.toNode}:`, condError);
                }
            }

            currentNode = nextNode;
        }

        console.log(`🏁 Workflow completed successfully!`);
        return this.globalContext;
    }
}


// ============================================================================
// TASK 2: RECURSIVE DESCENT AST PARSER, EVALUATOR & OPTIMIZER
// ============================================================================
/**
 * A lexical analyzer and recursive descent parser for an algebraic expression DSL.
 * Compiles a mathematical/logical string expression into a structured AST,
 * performs an optimization pass (constant folding), and evaluates it against values.
 */

const TokenType = {
    NUMBER: 'NUMBER',
    IDENTIFIER: 'IDENTIFIER',
    PLUS: 'PLUS',
    MINUS: 'MINUS',
    MULTIPLY: 'MULTIPLY',
    DIVIDE: 'DIVIDE',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    EOF: 'EOF'
};

class Lexer {
    constructor(input) {
        this.input = input;
        this.position = 0;
        this.currentChar = input[0] || null;
    }

    advance() {
        this.position++;
        this.currentChar = this.position < this.input.length ? this.input[this.position] : null;
    }

    skipWhitespace() {
        while (this.currentChar !== null && /\s/.test(this.currentChar)) {
            this.advance();
        }
    }

    number() {
        let result = '';
        while (this.currentChar !== null && /[0-9.]/.test(this.currentChar)) {
            result += this.currentChar;
            this.advance();
        }
        return { type: TokenType.NUMBER, value: parseFloat(result) };
    }

    identifier() {
        let result = '';
        while (this.currentChar !== null && /[a-zA-Z_][a-zA-Z0-9_]*/.test(this.currentChar)) {
            result += this.currentChar;
            this.advance();
        }
        return { type: TokenType.IDENTIFIER, value: result };
    }

    getNextToken() {
        while (this.currentChar !== null) {
            if (/\s/.test(this.currentChar)) {
                this.skipWhitespace();
                continue;
            }
            if (/[0-9]/.test(this.currentChar)) {
                return this.number();
            }
            if (/[a-zA-Z_]/.test(this.currentChar)) {
                return this.identifier();
            }
            if (this.currentChar === '+') {
                this.advance();
                return { type: TokenType.PLUS, value: '+' };
            }
            if (this.currentChar === '-') {
                this.advance();
                return { type: TokenType.MINUS, value: '-' };
            }
            if (this.currentChar === '*') {
                this.advance();
                return { type: TokenType.MULTIPLY, value: '*' };
            }
            if (this.currentChar === '/') {
                this.advance();
                return { type: TokenType.DIVIDE, value: '/' };
            }
            if (this.currentChar === '(') {
                this.advance();
                return { type: TokenType.LPAREN, value: '(' };
            }
            if (this.currentChar === ')') {
                this.advance();
                return { type: TokenType.RPAREN, value: ')' };
            }

            throw new Error(`Unknown token character: "${this.currentChar}" at index ${this.position}`);
        }

        return { type: TokenType.EOF, value: null };
    }
}

/**
 * Recursive Descent Parser
 * Grammar Rules:
 *   expr   : term ((PLUS | MINUS) term)*
 *   term   : factor ((MULTIPLY | DIVIDE) factor)*
 *   factor : NUMBER | IDENTIFIER | LPAREN expr RPAREN
 */
class ExpressionParser {
    constructor(lexer) {
        this.lexer = lexer;
        this.currentToken = this.lexer.getNextToken();
    }

    eat(tokenType) {
        if (this.currentToken.type === tokenType) {
            this.currentToken = this.lexer.getNextToken();
        } else {
            throw new Error(`Parser Error: Expected token type ${tokenType}, got ${this.currentToken.type}`);
        }
    }

    factor() {
        const token = this.currentToken;
        if (token.type === TokenType.NUMBER) {
            this.eat(TokenType.NUMBER);
            return { type: 'Literal', value: token.value };
        } else if (token.type === TokenType.IDENTIFIER) {
            this.eat(TokenType.IDENTIFIER);
            return { type: 'Identifier', name: token.value };
        } else if (token.type === TokenType.LPAREN) {
            this.eat(TokenType.LPAREN);
            const node = this.expr();
            this.eat(TokenType.RPAREN);
            return node;
        }
        throw new Error(`Unexpected factor element of type: ${token.type}`);
    }

    term() {
        let node = this.factor();

        while (this.currentToken.type === TokenType.MULTIPLY || this.currentToken.type === TokenType.DIVIDE) {
            const token = this.currentToken;
            if (token.type === TokenType.MULTIPLY) {
                this.eat(TokenType.MULTIPLY);
            } else if (token.type === TokenType.DIVIDE) {
                this.eat(TokenType.DIVIDE);
            }

            node = {
                type: 'BinaryExpression',
                operator: token.value,
                left: node,
                right: this.factor()
            };
        }

        return node;
    }

    expr() {
        let node = this.term();

        while (this.currentToken.type === TokenType.PLUS || this.currentToken.type === TokenType.MINUS) {
            const token = this.currentToken;
            if (token.type === TokenType.PLUS) {
                this.eat(TokenType.PLUS);
            } else if (token.type === TokenType.MINUS) {
                this.eat(TokenType.MINUS);
            }

            node = {
                type: 'BinaryExpression',
                operator: token.value,
                left: node,
                right: this.term()
            };
        }

        return node;
    }

    parse() {
        return this.expr();
    }
}

/**
 * AST Optimizer that performs compile-time constant folding.
 * Transforms subtrees like (5 + 10) into 15.
 */
class ASTOptimizer {
    static foldConstants(node) {
        if (!node) return null;

        if (node.type === 'BinaryExpression') {
            node.left = this.foldConstants(node.left);
            node.right = this.foldConstants(node.right);

            if (node.left.type === 'Literal' && node.right.type === 'Literal') {
                const leftVal = node.left.value;
                const rightVal = node.right.value;
                switch (node.operator) {
                    case '+': return { type: 'Literal', value: leftVal + rightVal };
                    case '-': return { type: 'Literal', value: leftVal - rightVal };
                    case '*': return { type: 'Literal', value: leftVal * rightVal };
                    case '/': return { type: 'Literal', value: leftVal / rightVal };
                }
            }
        }

        return node;
    }
}

/**
 * Computes runtime values of AST nodes against a specified context mapping.
 */
class ASTEvaluator {
    static evaluate(node, context = {}) {
        if (node.type === 'Literal') {
            return node.value;
        }

        if (node.type === 'Identifier') {
            if (!(node.name in context)) {
                throw new Error(`Evaluation Error: Reference to undefined variable "${node.name}"`);
            }
            return context[node.name];
        }

        if (node.type === 'BinaryExpression') {
            const leftVal = this.evaluate(node.left, context);
            const rightVal = this.evaluate(node.right, context);

            switch (node.operator) {
                case '+': return leftVal + rightVal;
                case '-': return leftVal - rightVal;
                case '*': return leftVal * rightVal;
                case '/':
                    if (rightVal === 0) throw new Error("Evaluation Error: Division by zero");
                    return leftVal / rightVal;
                default:
                    throw new Error(`Evaluation Error: Unsupported binary operator "${node.operator}"`);
            }
        }

        throw new Error(`Evaluation Error: Unrecognized AST Node type: ${node.type}`);
    }
}


// ============================================================================
// TASK 3: IN-MEMORY VECTOR INDEX & INFORMATION RETRIEVAL ENGINE
// ============================================================================
/**
 * A vector database and semantic index written entirely from scratch.
 * Integrates tokenization, custom English text stemming, stop-word pruning,
 * TF-IDF weight vectorization, and Cosine Similarity mapping.
 */
class VectorSearchEngine {
    constructor() {
        this.documents = []; // Array of { id, text, tokens, vector }
        this.globalVocabulary = new Set();
        this.idfCache = {};
    }

    static STOPWORDS = new Set([
        'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
        'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
        'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'dont', 'down', 'during', 'each', 'few',
        'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself',
        'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more',
        'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
        'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
        'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
        'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
        'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
        'yourself', 'yourselves'
    ]);

    /**
     * Extremely lightweight morphological suffix stripper (Porter Stemmer simplified).
     */
    static stem(word) {
        let w = word.toLowerCase().trim().replace(/[^a-z]/g, '');
        if (w.length < 3) return w;

        // Basic suffix rules for demonstrations
        if (w.endsWith('sses')) w = w.slice(0, -2);
        else if (w.endsWith('ies')) w = w.slice(0, -2) + 'i';
        else if (w.endsWith('ss')) {}
        else if (w.endsWith('s') && !w.endsWith('us') && !w.endsWith('as')) w = w.slice(0, -1);

        if (w.endsWith('eed')) {
            w = w.slice(0, -1); // agreed -> agree
        } else if (w.endsWith('ing')) {
            w = w.slice(0, -3);
            if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e'; // duplicating -> duplicate
        } else if (w.endsWith('ed')) {
            w = w.slice(0, -2);
        }

        if (w.endsWith('y') && w.length > 3) {
            w = w.slice(0, -1) + 'i';
        }

        return w;
    }

    /**
     * Performs clean text tokenization, filtering stop words and stemming terms.
     */
    static preprocess(text) {
        return text
            .toLowerCase()
            .split(/[^a-zA-Z0-9]+/)
            .filter(token => token.length > 1 && !VectorSearchEngine.STOPWORDS.has(token))
            .map(token => VectorSearchEngine.stem(token));
    }

    /**
     * Registers and indexes a text document.
     */
    addDocument(id, text) {
        const tokens = VectorSearchEngine.preprocess(text);
        tokens.forEach(tok => this.globalVocabulary.add(tok));
        this.documents.push({ id, text, tokens, vector: null });
        this.recalculateIndex();
    }

    /**
     * Recomputes the corpus vocabulary indices, IDF ratios, and TF-IDF vectors.
     */
    recalculateIndex() {
        const docCount = this.documents.length;
        this.idfCache = {};

        // 1. Calculate Document Frequency (DF) for each vocabulary word
        for (const word of this.globalVocabulary) {
            let df = 0;
            for (const doc of this.documents) {
                if (doc.tokens.includes(word)) df++;
            }
            // IDF = ln(1 + (Total Documents / Document Frequency))
            this.idfCache[word] = Math.log(1 + (docCount / (df || 1)));
        }

        // 2. Map TF-IDF frequency arrays for each document
        for (const doc of this.documents) {
            doc.vector = this.buildTFIDFVector(doc.tokens);
        }
    }

    /**
     * Converts raw tokens into a mapped spatial TF-IDF dense array.
     */
    buildTFIDFVector(tokens) {
        const tf = {};
        tokens.forEach(tok => { tf[tok] = (tf[tok] || 0) + 1; });

        const vector = [];
        for (const word of this.globalVocabulary) {
            const wordTF = tf[word] ? (tf[word] / tokens.length) : 0;
            const wordIDF = this.idfCache[word] || 0;
            vector.push(wordTF * wordIDF);
        }
        return vector;
    }

    /**
     * Measures spatial angle distance between two normalized vectors.
     */
    static cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            const a = vecA[i] || 0;
            const b = vecB[i] || 0;
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Semantic vector-based query retrieval.
     */
    search(queryText, limit = 3) {
        const queryTokens = VectorSearchEngine.preprocess(queryText);
        const queryVector = this.buildTFIDFVector(queryTokens);

        const hits = this.documents.map(doc => {
            const score = VectorSearchEngine.cosineSimilarity(queryVector, doc.vector);
            return { id: doc.id, text: doc.text, score };
        });

        return hits
            .filter(hit => hit.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}


// ============================================================================
// TASK 4: CONCURRENT WORK QUEUE & EVENT MULTIPLEXER WITH CIRCUIT BREAKERS
// ============================================================================
/**
 * Prevents system degradation under load by managing high-concurrency tasks,
 * implementing backpressure routing, and failing gracefully with circuit breakers.
 */

class CircuitBreaker {
    constructor(action, failureThreshold = 3, recoveryTimeoutMs = 2000) {
        this.action = action; // Function to protect
        this.failureThreshold = failureThreshold;
        this.recoveryTimeoutMs = recoveryTimeoutMs;

        this.state = 'CLOSED'; // States: CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastStateChange = Date.now();
    }

    async fire(...args) {
        this.checkState();

        if (this.state === 'OPEN') {
            throw new Error(`⚡ CircuitBreaker is OPEN. Request blocked to prevent cascading failures.`);
        }

        try {
            const result = await this.action(...args);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    checkState() {
        if (this.state === 'OPEN' && (Date.now() - this.lastStateChange > this.recoveryTimeoutMs)) {
            this.state = 'HALF_OPEN';
            this.lastStateChange = Date.now();
            console.log(`🔌 CircuitBreaker entered HALF_OPEN state. Probing endpoint service...`);
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state !== 'CLOSED') {
            this.state = 'CLOSED';
            this.lastStateChange = Date.now();
            console.log(`🔌 CircuitBreaker closed. Service fully recovered.`);
        }
    }

    onFailure(error) {
        this.failureCount++;
        console.warn(`⚡ CircuitBreaker failure count: ${this.failureCount}/${this.failureThreshold} (Error: ${error.message})`);
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.lastStateChange = Date.now();
            console.error(`⚡ CircuitBreaker tripped to OPEN! Restricting access for ${this.recoveryTimeoutMs}ms.`);
        }
    }
}

/**
 * A task processing queue that respects resource limits and controls backpressure.
 */
class ConcurrentWorkerQueue {
    constructor(concurrencyLimit = 2) {
        this.concurrencyLimit = concurrencyLimit;
        this.activeCount = 0;
        this.queue = [];
    }

    /**
     * Appends an asynchronous task with strict completion callbacks.
     */
    enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processNext();
        });
    }

    async processNext() {
        if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) {
            return;
        }

        this.activeCount++;
        const { task, resolve, reject } = this.queue.shift();

        try {
            const val = await task();
            resolve(val);
        } catch (err) {
            reject(err);
        } finally {
            this.activeCount--;
            this.processNext();
        }
    }
}


// ============================================================================
// VERIFICATION RUNNER (INTEGRATION DEMO)
// ============================================================================
async function runDemos() {
    console.log("================================================================================");
    console.log("🌟 RUNNING HIGHLY COMPLEX TASKS INTEGRATION DEMO 🌟");
    console.log("================================================================================");

    // ------------------------------------------------------------------------
    // Demo 1: Agentic DAG Workflow Engine Execution
    // ------------------------------------------------------------------------
    console.log("\n🧪 --- DEMO 1: AGENTIC DAG WORKFLOW ENGINE ---");
    const engine = new AgentWorkflowEngine();

    // Node 1: Planner
    engine.registerNode('Planner', async (ctx) => {
        console.log("   [Planner] Analyzing input request and designing task roadmap...");
        return { plan: ["Parse logic string", "Perform constant optimization", "Store variable states"] };
    });

    // Node 2: Logic Compiler
    engine.registerNode('Compiler', async (ctx) => {
        console.log("   [Compiler] Parsing and optimizing an algebraic string expression...");
        // Let's parse something complex: "x * 3 + (10 - 2 * 3)" -> Optimized: "x * 3 + 4"
        const expression = "x * 3 + (10 - 2 * 3)";
        const lexer = new Lexer(expression);
        const parser = new ExpressionParser(lexer);
        const rawAST = parser.parse();
        const optimizedAST = ASTOptimizer.foldConstants(rawAST);

        return { expression, rawAST, optimizedAST };
    });

    // Node 3: Evaluator (with simulated self-healing failure)
    engine.registerNode('Evaluator', async (ctx) => {
        console.log("   [Evaluator] Running expression calculations with active environment...");
        
        // Simulating context/variable parsing failure on first attempt to showcase self-correction
        if (ctx._retryAttempt === 1) {
            throw new Error("Missing system variable 'x' required for algebraic operation.");
        }

        const ast = ctx.Compiler.optimizedAST;
        // The error context has been fixed or we fall back. Let's provide a mock context including x
        const evalContext = { x: 5 };
        const result = ASTEvaluator.evaluate(ast, evalContext);

        return { evalContext, result };
    });

    // Node 4: Debugger (Self-Healing Fallback Agent)
    engine.registerNode('Debugger', async (ctx) => {
        console.log("   [Debugger] Running diagnostic analysis on failure reports...");
        console.log(`   [Debugger] Found: "${ctx._lastError.message}". Injecting missing values.`);
        // Returns corrective actions to workflow
        return { repaired: true };
    });

    // Configure the DAG transitions
    engine.addEdge('Planner', 'Compiler');
    engine.addEdge('Compiler', 'Evaluator');
    
    // If Evaluator fails, it tries to self-heal. But let's assume we proceed to wrap up on success
    engine.addEdge('Evaluator', null); 

    try {
        const finalWorkflowContext = await engine.execute('Planner', { initialGoal: "Compute formula values semantic style" });
        console.log(`\n🎉 Workflow finished. Result: x * 3 + (10 - 2 * 3) where x=5 is equal to: ${finalWorkflowContext.Evaluator.result}`);
    } catch (e) {
        console.error("Workflow Engine execution crashed:", e);
    }


    // ------------------------------------------------------------------------
    // Demo 2: Recursive Descent Parser & Constant Folding
    // ------------------------------------------------------------------------
    console.log("\n🧪 --- DEMO 2: AST COMPILER & CONSTANT FOLDER ---");
    const complexExpr = "y + (100 * 5) - (20 + 30)";
    console.log(`📝 Original Expression: "${complexExpr}"`);
    
    const lexer = new Lexer(complexExpr);
    const parser = new ExpressionParser(lexer);
    const ast = parser.parse();
    console.log("🌳 Raw Parsed AST structure (abbreviated):", JSON.stringify(ast, null, 2).slice(0, 300) + "...\n");

    const optimized = ASTOptimizer.foldConstants(ast);
    console.log("✨ Optimized AST (Constant-Folded) structure:", JSON.stringify(optimized, null, 2).slice(0, 300) + "...\n");

    const value = ASTEvaluator.evaluate(optimized, { y: 50 });
    console.log(`🔢 Evaluation Result of "${complexExpr}" with y=50 is: ${value} (Expected: 500)`);


    // ------------------------------------------------------------------------
    // Demo 3: In-Memory Vector Search Engine
    // ------------------------------------------------------------------------
    console.log("\n🧪 --- DEMO 3: SEMANTIC VECTOR SEARCH ENGINE ---");
    const vStore = new VectorSearchEngine();

    vStore.addDocument("doc1", "The fast agile agentic compiler optimizes code logic structures efficiently.");
    vStore.addDocument("doc2", "Building custom neural architectures and parsing mathematical formula trees.");
    vStore.addDocument("doc3", "Efficient asynchronous event loops and streaming data processors help backpressure mitigation.");
    vStore.addDocument("doc4", "This script implements custom vector database engines using cosine similarities.");

    const query = "efficient optimizer algorithm";
    console.log(`🔍 Query: "${query}"`);
    const results = vStore.search(query, 2);

    results.forEach((match, index) => {
        console.log(`   Rank #${index + 1}: Document [${match.id}] (Similarity Score: ${match.score.toFixed(4)})`);
        console.log(`      "${match.text}"`);
    });


    // ------------------------------------------------------------------------
    // Demo 4: Concurrent Queue with Circuit Breaker
    // ------------------------------------------------------------------------
    console.log("\n🧪 --- DEMO 4: CONCURRENT QUEUE & CIRCUIT BREAKER ---");
    
    const taskQueue = new ConcurrentWorkerQueue(2); // Concurrency limit of 2

    // Simple external API mock with failing conditions
    let requestCount = 0;
    const flakeyService = async (taskId) => {
        requestCount++;
        console.log(`      [Service] Task ${taskId} executing...`);
        if (requestCount >= 2 && requestCount <= 4) {
            throw new Error("HTTP 503 Service Unavailable");
        }
        return `Task ${taskId} response payload`;
    };

    const protectedService = new CircuitBreaker(flakeyService, 2, 1000);

    const taskFactory = (id) => async () => {
        try {
            const data = await protectedService.fire(id);
            console.log(`   ✔️ Queue Task Success: Received [${data}]`);
            return data;
        } catch (err) {
            console.error(`   ❌ Queue Task Failed: ${err.message}`);
        }
    };

    console.log("🚀 Enqueuing 6 tasks with concurrency limit = 2...");
    const promises = [
        taskQueue.enqueue(taskFactory(101)),
        taskQueue.enqueue(taskFactory(102)),
        taskQueue.enqueue(taskFactory(103)),
        taskQueue.enqueue(taskFactory(104)),
        taskQueue.enqueue(taskFactory(105)),
        taskQueue.enqueue(taskFactory(106))
    ];

    await Promise.all(promises);

    console.log("\n⏳ Waiting 1.2 seconds for Circuit Breaker recovery timeout...");
    await new Promise(resolve => setTimeout(resolve, 1200));

    console.log("🚀 Running a post-recovery task queue check...");
    await taskQueue.enqueue(taskFactory(107));
}

// Check if running as script to trigger integration demos
if (typeof require !== 'undefined' && require.main === module) {
    runDemos();
} else if (import.meta.main || (typeof process !== 'undefined' && process.argv[1] === import.meta.filename)) {
    runDemos();
}

export {
    AgentWorkflowEngine,
    Lexer,
    ExpressionParser,
    ASTOptimizer,
    ASTEvaluator,
    VectorSearchEngine,
    CircuitBreaker,
    ConcurrentWorkerQueue,
    runDemos
};

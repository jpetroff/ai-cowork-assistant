### Setup LlamaIndex Instrumentor

Source: <https://arize.com/docs/phoenix/integrations/python/llamaindex/llamaindex-workflows-tracing>

Initializes the LlamaIndexInstrumentor before application code. This instrumentor captures traces for both LlamaIndex Workflows and general LlamaIndex package calls. It requires importing the instrumentor and registering the tracer provider.

```python
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from phoenix.otel import register

tracer_provider = register()
LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
```

--------------------------------

### Instrument LlamaIndex with OpenAI and OTLP Tracing

Source: <https://arize.com/docs/phoenix/cookbook/evaluation/evaluate-rag>

Configures OTLP tracing for LlamaIndex to send traces to a specified endpoint. It sets up an OpenAI LLM and instruments the LlamaIndex library using LlamaIndexInstrumentor. Requires `openinference`, `opentelemetry`, and `llama-index` libraries.

```python
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
```

--------------------------------

### Run LlamaIndex Application with Automatic Tracing

Source: <https://arize.com/docs/phoenix/integrations/python/llamaindex/llamaindex-tracing>

Demonstrates a typical LlamaIndex application setup for RAG. With the LlamaIndexInstrumentor initialized, all operations like document loading, index creation, and querying will be automatically traced and sent to the Phoenix collector.

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
import os

os.environ["OPENAI_API_KEY"] = "YOUR OPENAI API KEY"

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("Some question about the data should go here")
print(response)
```

--------------------------------

### Run LiteLLM and Observe Traces in Phoenix

Source: <https://arize.com/docs/phoenix/integrations/llm-providers/litellm/litellm-tracing>

Demonstrates how to use the LiteLLM library as usual after setting up instrumentation. Calls to `litellm.completion()` will be automatically traced and visible in Phoenix. This example shows a basic call to the GPT-3.5 Turbo model.

```python
import litellm
completion_response = litellm.completion(model="gpt-3.5-turbo",
                   messages=[{"content": "What's the capital of China?", "role": "user"}])
print(completion_response)
```

--------------------------------

### Show Available LLM Providers (Python)

Source: <https://arize.com/docs/phoenix/evaluation/how-to-evals/configuring-the-llm>

This Python function displays currently supported LLM providers and their status, indicating if required dependencies are installed. It helps users identify which LLM backends can be used directly from their Python environment.

```python
from phoenix.evals.llm import show_provider_availability

show_provider_availability()
```

--------------------------------

### Get Tracer Object (Python)

Source: <https://arize.com/docs/phoenix/cookbook/ai-engineering-workflows/iterative-evaluation-and-experimentation-workflow-python>

Retrieves the OpenTelemetry tracer object, which can be used for manual instrumentation of specific functions or code blocks within the agent.

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)
```

--------------------------------

### Run Agno Agent and Observe Traces

Source: <https://arize.com/docs/phoenix/integrations/python/agno/agno-tracing>

Instantiate and run an Agno agent. This example demonstrates creating an agent using OpenAI's model and DuckDuckGo tools, then executing a query. Once tracing is set up, all agent invocations will be automatically streamed to Phoenix for observability.

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.duckduckgo import DuckDuckGoTools

agent = Agent(
    model=OpenAIChat(id="gpt-4o-mini"),
    tools=[DuckDuckGoTools()],
    markdown=True,
    debug_mode=True,
)

agent.run("What is currently trending on Twitter?")
```

--------------------------------

### Instrument LLM Spans with OpenAI Context Manager (Python)

Source: <https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument>

This snippet demonstrates how to instrument LLM calls using a context manager with the OpenAI Python client. It captures input, output, and potential exceptions, setting span status accordingly. Requires the `openai` and `opentelemetry` libraries.

```python
from openai import OpenAI
from opentelemetry.trace import Status, StatusCode

openai_client = OpenAI()

messages = [{"role": "user", "content": "Hello, world!"}]
with tracer.start_as_current_span("llm_span", openinference_span_kind="llm") as span:
    span.set_input(messages)
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=messages,
        )
    except Exception as error:
        span.record_exception(error)
        span.set_status(Status(StatusCode.ERROR))
    else:
        span.set_output(response)
        span.set_status(Status(StatusCode.OK))
```

--------------------------------

### Run and Trace LangChain

Source: <https://arize.com/docs/phoenix/integrations/python/langchain/langchain-tracing>

Demonstrates how to run a LangChain application after setting up the Phoenix tracer. Instrumenting LangChain ensures that spans are created for chain invocations and sent to the Phoenix server for collection and observation.

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

prompt = ChatPromptTemplate.from_template("{x} {y} {z}?").partial(x="why is", z="blue")
chain = prompt | ChatOpenAI(model_name="gpt-3.5-turbo")
chain.invoke(dict(y="sky"))
```

--------------------------------

### Display Input and Retrieved Documents (Python)

Source: <https://arize.com/docs/phoenix/cookbook/evaluation/evaluate-rag>

This Python code displays the 'attributes.input.value' and 'attributes.retrieval.documents' columns for the filtered spans DataFrame. It helps in correlating the input query with the documents that were retrieved during the RAG process.

```python
spans_with_docs_df[["attributes.input.value", "attributes.retrieval.documents"]].head()
```

--------------------------------

### Filter Spans with Retrieved Documents (Python)

Source: <https://arize.com/docs/phoenix/cookbook/evaluation/evaluate-rag>

This Python code filters the spans DataFrame to include only those spans that have associated retrieved documents. This is useful for isolating and analyzing the retrieval step of the RAG pipeline.

```python
spans_with_docs_df = spans_df[spans_df["attributes.retrieval.documents"].notnull()]
```

--------------------------------

### Trace Agents with Decorators (Python)

Source: <https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument>

Demonstrates tracing agents using decorators in Python for a more streamlined approach. Requires the 'arize-phoenix' library.

```python
@tracer.agent
def decorated_agent(input: str) -> str:
    return "output"

decorated_agent("input")
```

--------------------------------

### Create a Math Solver Agent (Python)

Source: <https://arize.com/docs/phoenix/cookbook/evaluation/using-ragas-to-evaluate-a-math-problem-solving-agent>

Initializes a Python `Agent` named 'Math Solver'. This agent is configured with instructions to solve math problems by evaluating them using Python and is equipped with the `solve_equation` tool.

```python
from agents import Agent

agent = Agent(
    name="Math Solver",
    instructions="You solve math problems by evaluating them with python and returning the result",
    tools=[solve_equation],
)
```

--------------------------------

### Install LlamaIndex Instrumentation

Source: <https://arize.com/docs/phoenix/integrations/python/llamaindex/llamaindex-workflows-tracing>

Installs the necessary OpenInference instrumentation package for LlamaIndex using pip. This package provides the LlamaIndexInstrumentor.

```bash
pip install openinference-instrumentation-llama_index
```

--------------------------------

### Define Evaluation Feedback with Pydantic - Python

Source: <https://arize.com/docs/phoenix/cookbook/agent-workflow-patterns/openai-agents>

This Python code defines a Pydantic model `EvaluationFeedback` to structure feedback for evaluating research reports. It includes fields for textual feedback and a categorical score, ensuring consistent output format for the evaluation agent.

```python
class EvaluationFeedback(BaseModel):
    feedback: str = Field(
        description=f"What is missing from the research report on positive and negative catalysts for a particular stock ticker. Catalysts include changes in {CATALYSTS}.")
    score: Literal["pass", "needs_improvement", "fail"] = Field(
        description="A score on the research report. Pass if the report is complete and contains at least 3 positive and 3 negative catalysts for the right stock ticker, needs_improvement if the report is missing some information, and fail if the report is completely wrong.")
```

--------------------------------

### Define Asynchronous Pairwise Evaluator for LlamaIndex

Source: <https://arize.com/docs/phoenix/cookbook/datasets-and-experiments/comparing-llamaindex-query-engines-with-a-pairwise-evaluator>

This snippet defines an asynchronous evaluator function using LlamaIndex's PairwiseComparisonEvaluator. It compares two responses (output and expected) based on a given query and returns a score and feedback. This is useful for A/B testing different query engines.

```python
llm = OpenAI(temperature=0, model="gpt-4o")


async def pairwise(output, input, expected) -> Tuple[Score, Explanation]:
    ans = await PairwiseComparisonEvaluator(llm=llm).aevaluate(
        query=input["instruction"],
        response=output,
        second_response=expected["response"],
    )
    return ans.score, ans.feedback

evaluators = [pairwise]
```

--------------------------------

### Define Structured Output Models (Python)

Source: <https://arize.com/docs/phoenix/cookbook/agent-workflow-patterns/openai-agents>

These Python classes define the expected structured output for different agents. They use Pydantic's BaseModel for data validation and serialization, specifying fields like ticker, allocation, reason, and evaluation scores.

```python
class PortfolioItem(BaseModel):
    ticker: str = Field(description="The ticker of the stock or ETF.")
    allocation: float = Field(
        description="The percentage allocation of the ticker in the portfolio. The sum of all allocations should be 100."
    )
    reason: str = Field(description="The reason why this ticker is included in the portfolio.")


class Portfolio(BaseModel):
    tickers: list[PortfolioItem] = Field(
        description="A list of tickers that could support the user's stated investment strategy."
    )


class EvaluationFeedback(BaseModel):
    feedback: str = Field(
        description="What data is missing in order to create a portfolio of stocks and ETFs based on the user's investment strategy."
    )
    score: Literal["pass", "needs_improvement", "fail"] = Field(
        description="A score on the research report. Pass if you have at least 5 tickers with data that supports the user's investment strategy to create a portfolio, needs_improvement if you do not have enough supporting data, and fail if you have no tickers."
    )

```

--------------------------------

### Trace Agents with Context Managers (Python)

Source: <https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument>

Shows how to trace agents using context managers in Python. Similar to chains, this allows manual control over span attributes and status. Requires the 'arize-phoenix' library.

```python
from opentelemetry.sdk.trace import Status
from opentelemetry.sdk.trace.export import StatusCode

with tracer.start_as_current_span(
    "agent-span-with-plain-text-io",
    openinference_span_kind="agent",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_status(Status(StatusCode.OK))
```

--------------------------------

### Define Math Solving Tool for Agent (Python)

Source: <https://arize.com/docs/phoenix/cookbook/evaluation/using-ragas-to-evaluate-a-math-problem-solving-agent>

Defines a Python function tool `solve_equation` that utilizes Python's `eval()` to solve mathematical equations. This tool is intended to be used by an agent to perform calculations.

```python
from agents import Runner, function_tool

@function_tool
def solve_equation(equation: str) -> str:
    """Use python to evaluate the math equation, instead of thinking about it yourself.

    Args:
       equation: string to pass into eval() in python
    """
    return str(eval(equation))
```

--------------------------------

### Instrumenting OpenAI API Calls with OpenInference

Source: <https://arize.com/docs/phoenix/sdk-api-reference/openinference-sdk/openinference-python>

This Python code demonstrates how to instrument OpenAI API calls using the OpenInference library. It sets up the OpenTelemetry SDK with an HTTP exporter to send traces to a collector and then makes a chat completion request. Ensure the collector is running and the OPENAI_API_KEY environment variable is set.

```python
import openai
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

# Set up the OpenTelemetry SDK tracer provider with an HTTP exporter.
# Change the endpoint if the collector is running at a different location.
endpoint = "http://localhost:6006/v1/traces"
resource = Resource(attributes={})
tracer_provider = trace_sdk.TracerProvider(resource=resource)
span_exporter = OTLPSpanExporter(endpoint=endpoint)
span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
tracer_provider.add_span_processor(span_processor=span_processor)
trace_api.set_tracer_provider(tracer_provider=tracer_provider)

# Call the instrumentor to instrument OpenAI
OpenAIInstrumentor().instrument()

# Run the OpenAI application.
# Make you have your API key set in the environment variable OPENAI_API_KEY.
if __name__ == "__main__":
    response = openai.OpenAI().chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Write a haiku."}
        ],
        max_tokens=20,
    )
    print(response.choices[0].message.content)
```

--------------------------------

### Instrument OpenAI Calls (Python)

Source: <https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces>

Initializes and instruments the OpenAI client using the OpenAIInstrumentor. This allows traces of OpenAI interactions to be captured.

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

--------------------------------

### Evaluate Experiment with Defined Evaluators

Source: <https://arize.com/docs/phoenix/cookbook/datasets-and-experiments/comparing-llamaindex-query-engines-with-a-pairwise-evaluator>

This snippet evaluates a previously set up experiment using a list of defined evaluators. It processes the experiment data and applies the evaluators to score and analyze the results.

```python
experiment = evaluate_experiment(experiment, evaluators)
```

--------------------------------

### Define Agent Task for Experiment - Python

Source: <https://arize.com/docs/phoenix/cookbook/ai-engineering-workflows/iterative-evaluation-and-experimentation-workflow-python>

Defines a Python function `agent_task` that serves as the task for an experiment. This function takes an input dictionary, extracts the 'input' field to use as a query for the `trip_agent`, and returns the content of the agent's response.

```python
def agent_task(input):
    query = input["input"]
    response = trip_agent.run(query, stream=False)
    return response.content
```

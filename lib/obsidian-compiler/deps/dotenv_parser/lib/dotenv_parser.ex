defmodule DotenvParser do
  @moduledoc """
  Simple parser for dotenv style files.

  Supports simple variable–value pairs with upper and lower cased variables. Values are trimmed of extra whitespace.

  Blank lines and lines starting with `#` are ignored. Additionally inline comments can be added after values with a
  `#`, i.e. `FOO=bar # comment`.

  Single quote or double quote value to prevent trimming of whitespace and allow usage of `#` in value, i.e. `FOO='  bar # not comment ' # comment`.

  Single quoted values don't do any unescaping. Double quoted values will unescape the following:

  * `\\n` - Linefeed
  * `\\r` - Carriage return
  * `\\t` - Tab
  * `\\f` - Form feed
  * `\\b` - Backspace
  * `\\"` and `\\'` - Quotes
  * `\\\\` - Backslash
  * `\\uFFFF` - Unicode escape (4 hex characters to denote the codepoint)
  * A backslash at the end of the line in a multiline value will remove the linefeed.

  Values can span multiple lines when single or double quoted:

  ```sh
  MULTILINE="This is a
  multiline value."
  ```

  This will result in the following:

  ```elixir
  System.fetch_env!("MULTILINE") == "This is a\\nmultiline value."
  ```

  A line can start with `export ` for easier interoperation with regular shell scripts. These lines are treated the
  same as any others.

  ## Serving suggestion

  If you load lots of environment variables in `config/runtime.exs`, you can easily configure them for development by
  having an `.env` file in your development environment and using DotenvParser at the start of the file:

  ```elixir
  import Config

  if Config.config_env() == :dev do
    DotenvParser.load_file(".env")
  end

  # Now variables from `.env` are loaded into system env
  config :your_project,
    database_url: System.fetch_env!("DB_URL")
  """

  @linefeed_re ~r/\r?\n/
  @line_re ~r/^(?:\s*export)?\s*[a-z_][a-z_0-9]*\s*=/i
  @dquoted_val_re ~r/^"([^"\\]*(?:\\.[^"\\]*)*)"\s*(?:#.*)?$/
  @squoted_val_re ~r/^\s*'(.*)'\s*(?:#.*)?$/
  @dquoted_multiline_end ~r/^([^"\\]*(?:\\.[^"\\]*)*)"\s*(?:#.*)?$/
  @squoted_multiline_end ~r/^(.*)'\s*(?:#.*)?$/
  @hex_re ~r/^[0-9a-f]+$/i

  @quote_chars ~w(" ')

  @typedoc "Pair of variable name, variable value."
  @type value_pair :: {String.t(), String.t()}

  defmodule ParseError do
    @moduledoc "Error raised when a line cannot be parsed."
    defexception [:message]
  end

  defmodule Continuation do
    @typedoc """
    A multiline value continuation. When a function returns this, it means that a multiline value
    was started and more needs to be parsed to get the rest of the value.
    """
    @type t :: %__MODULE__{
            name: String.t(),
            value: String.t(),
            start_quote: String.t()
          }
    @enforce_keys [:name, :value, :start_quote]
    defstruct [:name, :value, :start_quote]
  end

  @doc """
  Parse given file and load the variables to the environment.

  If a line cannot be parsed or the file cannot be read, an error is raised and no values are loaded to the
  environment.
  """
  @spec load_file(String.t()) :: :ok
  def load_file(file) do
    file
    |> File.read!()
    |> load_data()
  end

  @doc """
  Parse given data and load the variables to the environment.

  If a line cannot be parsed, an error is raised and no values are loaded to the environment.
  """
  @spec load_data(String.t()) :: :ok
  def load_data(data) do
    data
    |> parse_data()
    |> Enum.each(fn {var, val} -> System.put_env(var, val) end)
  end

  @doc """
  Parse given file and return a list of variable–value tuples.

  If a line cannot be parsed or the file cannot be read, an error is raised.
  """
  @spec parse_file(String.t()) :: [value_pair()]
  def parse_file(file) do
    file
    |> File.read!()
    |> parse_data()
  end

  @doc """
  Parse given data and return a list of variable–value tuples.

  If a line cannot be parsed, an error is raised.
  """
  @spec parse_data(String.t()) :: [value_pair()]
  def parse_data(data) do
    {value_pairs, continuation} =
      data
      |> String.split(@linefeed_re)
      |> Enum.reduce({[], nil}, fn
        line, {ret, nil} ->
          trimmed = String.trim(line)

          if not is_comment?(trimmed) and not is_blank?(trimmed) do
            reduce_line(ret, line, nil)
          else
            {ret, nil}
          end

        line, {ret, continuation} ->
          reduce_line(ret, line, continuation)
      end)

    if not is_nil(continuation) do
      raise ParseError,
            "Could not find end for quote #{continuation.start_quote} in variable #{continuation.name}"
    end

    Enum.reverse(value_pairs)
  end

  @doc """
  Parse given single line and return a variable–value tuple, or a continuation value if the line
  started or continued a multiline value.

  If line cannot be parsed, an error is raised.

  The second argument needs to be `nil` or a continuation value returned from parsing the previous
  line.
  """
  @spec parse_line(String.t(), Continuation.t() | nil) :: value_pair() | Continuation.t()
  def parse_line(line, state)

  def parse_line(line, nil) do
    if not Regex.match?(@line_re, line) do
      raise ParseError, "Malformed line cannot be parsed: #{line}"
    else
      [var, val] = String.split(line, "=", parts: 2)
      var = var |> String.trim() |> String.replace_leading("export ", "")
      trimmed = String.trim(val)

      with {:dquoted, nil} <- {:dquoted, Regex.run(@dquoted_val_re, trimmed)},
           {:squoted, nil} <- {:squoted, Regex.run(@squoted_val_re, trimmed)},
           trimmed_leading = String.trim_leading(val),
           {:quoted_start, false} <-
             {:quoted_start, String.starts_with?(trimmed_leading, @quote_chars)} do
        # Value is plain value
        {var, trimmed |> remove_comment() |> String.trim()}
      else
        {:dquoted, [_, inner_val]} ->
          {var, stripslashes(inner_val)}

        {:squoted, [_, inner_val]} ->
          {var, inner_val}

        {:quoted_start, _} ->
          parse_multiline_start(var, val)
      end
    end
  end

  def parse_line(line, %Continuation{} = continuation) do
    trimmed = String.trim_trailing(line)

    end_match =
      if continuation.start_quote == "\"" do
        Regex.run(@dquoted_multiline_end, trimmed)
      else
        Regex.run(@squoted_multiline_end, trimmed)
      end

    with [_, line_content] <- end_match do
      ret = maybe_stripslashes(continuation, line_content)
      {continuation.name, continuation.value <> ret}
    else
      _ ->
        next_line = maybe_stripslashes(continuation, line)
        next_line = maybe_linefeed(continuation, next_line)

        %Continuation{
          continuation
          | value: continuation.value <> next_line
        }
    end
  end

  @spec parse_multiline_start(String.t(), String.t()) :: Continuation.t()
  defp parse_multiline_start(name, input) do
    {start_quote, rest} = input |> String.trim_leading() |> String.split_at(1)

    continuation = %Continuation{
      name: name,
      value: "",
      start_quote: start_quote
    }

    value = maybe_stripslashes(continuation, rest)
    value = maybe_linefeed(continuation, value)

    %Continuation{continuation | value: value}
  end

  @spec reduce_line([value_pair()], String.t(), Continuation.t() | nil) ::
          {[value_pair()], Continuation.t() | nil}
  defp reduce_line(ret, line, continuation) do
    case parse_line(line, continuation) do
      %Continuation{} = new_continuation ->
        {ret, new_continuation}

      result ->
        {[result | ret], nil}
    end
  end

  @spec remove_comment(String.t()) :: String.t()
  defp remove_comment(val) do
    case String.split(val, "#", parts: 2) do
      [true_val, _comment] -> true_val
      [true_val] -> true_val
    end
  end

  @spec is_comment?(String.t()) :: boolean()
  defp is_comment?(line)
  defp is_comment?("#" <> _rest), do: true
  defp is_comment?(_line), do: false

  @spec is_blank?(String.t()) :: boolean()
  defp is_blank?(line)
  defp is_blank?(""), do: true
  defp is_blank?(_line), do: false

  @spec stripslashes(String.t(), :slash | :no_slash, String.t()) :: String.t()
  defp stripslashes(input, mode \\ :no_slash, acc \\ "")

  defp stripslashes("\\" <> rest, :no_slash, acc) do
    stripslashes(rest, :slash, acc)
  end

  defp stripslashes("", :no_slash, acc), do: acc

  defp stripslashes(input, :no_slash, acc) do
    case String.split(input, "\\", parts: 2) do
      [all] -> acc <> all
      [head, tail] -> stripslashes(tail, :slash, acc <> head)
    end
  end

  defp stripslashes("n" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\n")
  defp stripslashes("r" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\r")
  defp stripslashes("t" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\t")
  defp stripslashes("f" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\f")
  defp stripslashes("b" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\b")
  defp stripslashes("\"" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\"")
  defp stripslashes("'" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "'")
  defp stripslashes("\\" <> rest, :slash, acc), do: stripslashes(rest, :no_slash, acc <> "\\")

  defp stripslashes(<<"u", hex::binary-size(4), rest::binary>>, :slash, acc) do
    with true <- Regex.match?(@hex_re, hex),
         {int, _rest} <- Integer.parse(hex, 16) do
      stripslashes(rest, :no_slash, acc <> <<int::utf8>>)
    else
      _ -> stripslashes(rest, :no_slash, acc <> "\\u" <> hex)
    end
  end

  defp stripslashes(input, :slash, acc), do: stripslashes(input, :no_slash, acc <> "\\")

  @spec maybe_stripslashes(Continuation.t(), String.t()) :: String.t()
  defp maybe_stripslashes(continuation, input)

  defp maybe_stripslashes(%Continuation{start_quote: "\""}, input), do: stripslashes(input)
  defp maybe_stripslashes(_, input), do: input

  @spec maybe_linefeed(Continuation.t(), String.t()) :: String.t()
  defp maybe_linefeed(continuation, input)

  defp maybe_linefeed(%Continuation{start_quote: "\""}, input) do
    if String.ends_with?(input, "\\") do
      String.slice(input, 0..-2//1)
    else
      input <> "\n"
    end
  end

  defp maybe_linefeed(_, input), do: input <> "\n"
end

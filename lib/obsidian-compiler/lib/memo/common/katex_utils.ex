defmodule Memo.Common.KatexUtils do
  @moduledoc """
  Utility functions for processing KaTeX in markdown content.
  """

  @doc """
  Wraps multi-line KaTeX content inside a <span> tag.
  """
  def wrap_multiline_katex(content) do
    Regex.replace(~r/\$\$([\s\S]*?)\$\$/m, content, fn _, katex_content ->
      if String.contains?(katex_content, "\n") do
        "\n$$#{katex_content}$$\n"
      else
        "$$#{katex_content}$$"
      end
    end)
  end
end

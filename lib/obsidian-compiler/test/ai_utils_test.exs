defmodule Memo.Common.AIUtilsTest do
  use ExUnit.Case, async: false

  alias Memo.Common.AIUtils

  @empty %{"keywords" => [], "summary" => ""}

  setup do
    previous = System.get_env("OPENCODE_GO_API_KEY")
    System.delete_env("OPENCODE_GO_API_KEY")

    on_exit(fn ->
      if previous, do: System.put_env("OPENCODE_GO_API_KEY", previous)
    end)

    :ok
  end

  test "short text never reaches the model" do
    assert AIUtils.spr_compress("too short to compress") == @empty
  end

  test "a missing key degrades to an empty result instead of crashing" do
    assert AIUtils.spr_compress(String.duplicate("long enough content ", 20)) == @empty
  end
end

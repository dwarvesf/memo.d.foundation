defmodule MemoTest do
  use ExUnit.Case
  doctest Memo

  test "greets the world" do
    assert Memo.hello() == :world
  end
end

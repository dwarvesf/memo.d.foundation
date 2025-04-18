defmodule Memo.MixProject do
  use Mix.Project

  def project do
    [
      app: :memo,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger],
      mod: {Memo.Application, []}
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:flow, "~> 1.2"},
      {:jason, "~> 1.4"},
      {:yaml_elixir, "~> 2.9"},
      {:dotenv_parser, "~> 2.0"},
      {:httpoison, "~> 2.2"},
      {:file_system, "~> 1.0"},
      {:ffmpex, "~> 0.11"},
      {:mogrify, "~> 0.9.3"},
      {:neuron, "~> 5.1.0"}
    ]
  end
end

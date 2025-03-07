defmodule DotenvParser.MixProject do
  use Mix.Project

  def project do
    [
      app: :dotenv_parser,
      version: "2.0.1",
      elixir: "~> 1.12",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      docs: [
        main: DotenvParser
      ],
      description: "Simple library to parse and load dotenv files.",
      package: [
        licenses: ["MIT", "BSD-2-Clause"],
        links: %{"GitLab" => "https://gitlab.com/Nicd/dotenv-parser"}
      ],
      source_url: "https://gitlab.com/Nicd/dotenv-parser",
      homepage_url: "https://gitlab.com/Nicd/dotenv-parser"
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: []
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:ex_doc, "~> 0.28.0", only: :dev}
    ]
  end
end

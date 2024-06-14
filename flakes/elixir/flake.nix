{
  description =
    "A flake that adds Elixir 1.16.x with Erlang OTP 27";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/master";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        packages = {
          elixir = pkgs.beam.packages.erlang_27.elixir_1_16;
          elixir-ls = pkgs.beam.packages.erlang_27.elixir-ls;
        };
      });
}

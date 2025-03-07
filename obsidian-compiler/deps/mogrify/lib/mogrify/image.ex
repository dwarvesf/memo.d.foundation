defmodule Mogrify.Image do

  @type path        :: binary
  @type ext         :: binary
  @type format      :: binary
  @type width       :: integer
  @type height      :: integer
  @type animated    :: boolean
  @type frame_count :: integer
  @type buffer      :: Collectable.t
  @type operations  :: Keyword.t
  @type dirty       :: %{atom => any}

  @type t :: %__MODULE__{
    path:        path,
    ext:         ext,
    format:      format,
    width:       width,
    height:      height,
    animated:    animated,
    frame_count: frame_count,
    buffer:      buffer,
    operations:  operations,
    dirty:       dirty
  }

  defstruct path:        nil,
            ext:         nil,
            format:      nil,
            width:       nil,
            height:      nil,
            animated:    false,
            frame_count: 1,
            buffer:      nil,
            operations:  [],
            dirty:       %{}
end

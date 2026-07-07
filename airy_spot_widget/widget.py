from pathlib import Path
from importlib.resources import files

import anywidget
import traitlets


class AirySpotWidget(anywidget.AnyWidget):
    """Interactive Airy pattern widget rendered with D3 in the browser."""

    _esm = files("airy_spot_widget.static").joinpath("widget.js")
    _css = files("airy_spot_widget.static").joinpath("widget.css")

    wavelength_nm = traitlets.Float(550.0).tag(sync=True)
    aperture_mm = traitlets.Float(25.0).tag(sync=True)
    distance_m = traitlets.Float(1.5).tag(sync=True)
    field_zoom = traitlets.Float(1.0).tag(sync=True)

"""Shared Pydantic configuration for all schemas."""
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class SharedConfig(BaseModel):
    """Base class with shared Pydantic configuration for all schemas.
    
    Provides:
    - populate_by_name: Accept both field name and alias
    - alias_generator: Convert field names to camelCase for API responses
    - from_attributes: Allow creating models from ORM objects
    """
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True
    )

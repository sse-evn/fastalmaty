package models

type Stats struct {
	Total     int `json:"total"`
	New       int `json:"new"`
	Progress  int `json:"progress"`
	Delivered int `json:"delivered"`
	Completed int `json:"completed"`
}
